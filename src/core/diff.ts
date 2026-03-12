export type ObjectPatchAdd = ['a', string, any]
export type ObjectPatchSet = ['s', string, any]
export type ObjectPatchRemove = ['d', string]

export type ObjectPatchOp = ObjectPatchAdd | ObjectPatchSet | ObjectPatchRemove
export type ObjectPatchDiff = ObjectPatchOp[]

type PathSplits = (string | number)[]

function diffEncodePath(path: PathSplits): string {
	if (path.length === 0) return ''
	return '/' + path.map((x) => (x + '').replace(/~/g, '~0').replace(/\//g, '~1')).join('/')
}

function diffDecodePath(path: string): PathSplits {
	if (path == '') {
		return []
	} else if (!path.startsWith('/')) {
		throw Error(`Invalid path string "${path}"`)
	}
	return path
		.substring(1)
		.split('/')
		.map((x) => x.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function jsonTypeof(
	value: any
): 'boolean' | 'number' | 'string' | 'array' | 'object' | 'undefined' {
	const t = typeof value
	if (t === 'bigint') {
		return 'number'
	} else if (t === 'function' || t === 'symbol') {
		throw Error(`Unsupported value type "${t}"`)
	} else if (t === 'object' && Array.isArray(value)) {
		return 'array'
	} else {
		return t
	}
}

function diffCreateOp(diff: ObjectPatchDiff, currentPath: PathSplits, from: any, to: any) {
	// They are the same value, skip the check
	if (from === to) {
		return
	}

	const tFrom = jsonTypeof(from)
	const tTo = jsonTypeof(to)
	if (tFrom !== tTo) {
		// Type has changed, complete reset
		diff.push(['s', diffEncodePath(currentPath), to])
	} else if (tFrom === 'object') {
		// Compare all keys in a dictionary
		const fromKeys = new Set(Object.keys(from))
		const toKeys = new Set(Object.keys(to))
		const keys = new Set([...fromKeys, ...toKeys])

		// Add heuristic. If more than 50% of the  changes replace it completely
		// this should help to prevent value explosions when arrays are shifting
		for (const key of keys) {
			if (!toKeys.has(key)) {
				// Dropped
				diff.push(['d', diffEncodePath([...currentPath, key])])
			} else if (!fromKeys.has(key)) {
				// Added
				diff.push(['s', diffEncodePath([...currentPath, key]), to[key]])
			} else {
				// Stable key
				diffCreateOp(diff, [...currentPath, key], from[key], to[key])
			}
		}
	} else if (tFrom === 'array') {
		// Compare items for minimum number of edits
		// https://github.com/stefankoegl/python-json-patch/blob/master/jsonpatch.py#L876
		// (!) This is not the optimal editing distance and is inefficient during drifts
		// but is way more efficient to compute than any alternative.
		const lengthMax = Math.max(from.length, to.length)
		const lengthMin = Math.min(from.length, to.length)
		for (let i = 0; i < lengthMax; i++) {
			if (i < lengthMin) {
				// Stable index
				diffCreateOp(diff, [...currentPath, i], from[i], to[i])
			} else if (from.length > to.length) {
				// Array shortened
				diff.push(['d', diffEncodePath([...currentPath, i])])
			} else {
				// Array extended
				diff.push(['a', diffEncodePath([...currentPath, '-']), to[i]])
			}
		}
	} else if (tFrom === 'string') {
		// Compare strings and check if we can do a simple delta
		if (to.startsWith(from)) {
			diff.push(['a', diffEncodePath([...currentPath, '-']), to.substring(from.length)])
		} else {
			diff.push(['s', diffEncodePath(currentPath), to])
		}
	} else {
		// Any other value is replaced
		diff.push(['s', diffEncodePath(currentPath), to])
	}
}

/**
 * Creates a set of diff operations to transition from Object to Object
 */
export function diffCreate<T extends object>(from: T | undefined, to: T): ObjectPatchDiff {
	const diff: ObjectPatchDiff = []
	diffCreateOp(diff, [], from, to)
	return diff
}

function diffApplyOp(
	currentPath: PathSplits,
	restPath: PathSplits,
	value: any,
	op: ObjectPatchOp
): any {
	// Final value set
	if (restPath.length === 0) {
		if (op[0] !== 's') {
			throw Error(`Cannot perform operation ${op[0]} at "${op[1]}"`)
		} else {
			return op[2]
		}
	}

	// Check
	const key = restPath[0]
	if (key === '-' && (op[0] !== 'a' || restPath.length > 1)) {
		throw Error(`Cannot perform operation ${op[0]} for "-" indexes at "${op[1]}"`)
	}

	// Nest navigation
	const nextCurrentPath = [...currentPath, key]
	const nextRestPath = restPath.slice(1)
	const isDelete = nextRestPath.length === 0 && op[0] === 'd'
	if (typeof value === 'object' && Array.isArray(value)) {
		if (key === '-') {
			return [...value, (op as any)[2]]
		} else {
			const ix = Number.parseInt(key as any, 10)
			if (Number.isNaN(ix) || ix < 0 || ix >= value.length) {
				throw Error(`Invalid access index ${ix} for operation ${op[0]} at "${op[1]}"`)
			}
			if (isDelete) {
				return value.filter((_, jx) => ix !== jx)
			} else {
				return value.map((v, jx) =>
					ix !== jx ? v : diffApplyOp(nextCurrentPath, nextRestPath, v, op)
				)
			}
		}
	} else if (typeof value === 'object') {
		if (isDelete) {
			return { ...value, [key]: undefined }
		} else {
			return {
				...value,
				[key]: diffApplyOp(nextCurrentPath, nextRestPath, value[key], op)
			}
		}
	} else if (typeof value === 'string') {
		// Stream text
		if (key === '-') {
			return value + (op as any)[2]
		}
	}
}

/**
 * Apply a complete set of diff operations to an Object
 */
export function diffApply<T extends object>(value: T, diff: ObjectPatchDiff): T {
	for (const op of diff) {
		const path = diffDecodePath(op[1])
		value = diffApplyOp([], path, value, op)
	}
	return value
}
