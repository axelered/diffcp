import type { ObjectStream } from './stream.ts'
import type { ObjectPatchDiff } from './diff.ts'

/**
 * Simple compression system
 */
export class Compressor<T extends object, E> {
	async *deflate(messages: AsyncIterable<ObjectStream<T, E>>): AsyncIterable<any> {
		const objType = { init: 1, delta: 2, done: 3, event: 9 } as const
		const patchType = { a: 1, d: 2, s: 3 } as const // Add, Remove, Replace RFC6902
		const deltaDict: Record<string, number> = {}
		let deltaOffset = 0

		for await (const msg of messages) {
			if (msg.t === 'delta') {
				// Delta compression
				const delta: any = []
				for (const [typ, path, ...rest] of msg.d) {
					delta.push([
						patchType[typ],
						// Previous Occurrence Compression
						path in deltaDict ? deltaOffset - deltaDict[path] : path,
						...rest
					])
					deltaDict[path] = deltaOffset
					deltaOffset += 1
				}
				yield [objType.delta, delta]
			} else {
				yield msg.d ? [objType[msg.t], msg.d] : [objType[msg.t]]
			}
		}
	}

	async *inflate(compressed: AsyncIterable<any>): AsyncIterable<ObjectStream<T, E>> {
		const objType = { 1: 'init', 2: 'delta', 3: 'done', 9: 'event' } as any
		const patchType = { 1: 'a', 2: 'd', 3: 's' } as any // Add, Remove, Replace RFC6902
		const deltaDict: Record<number, string> = {}
		const deltaDictInv: Record<string, number> = {}
		let deltaOffset = 0

		for await (const [typ, data] of compressed) {
			if (objType[typ] === 'delta') {
				const delta: ObjectPatchDiff = []
				for (const [typ, path, ...rest] of data) {
					let decPath = path
					if (typeof path === 'number') {
						const oldOffset = deltaOffset - path
						decPath = deltaDict[oldOffset]
						delete deltaDict[oldOffset]
					}
					// This is needed to kep the main dictionary void of any duplicates. This may
					// be dangerous in case the client is not sending a compressed stream.
					if (decPath in deltaDictInv) delete deltaDict[deltaDictInv[decPath]]
					deltaDictInv[decPath] = deltaOffset
					//
					deltaDict[deltaOffset] = decPath
					deltaOffset += 1

					delta.push([patchType[typ], decPath, ...rest] as any)
				}
				yield { t: 'delta', d: delta }
			} else {
				yield { t: objType[typ], d: data }
			}
		}
	}
}
