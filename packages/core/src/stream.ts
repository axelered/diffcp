import {
	fetchNdJSON,
	type NdJSONFetchRequestInit,
	NdJSONStreamResponse,
	type NDJSONStreamResponseInit,
	PlainJsonError
} from './ndjson'
import { diffApply, diffCreate, type ObjectPatchDiff } from './diff'
import { type CompressedObjectStream, deflate, inflate } from './zip'

export type ObjectStream<T extends object, E> =
	| { t: 'init'; d: T }
	| { t: 'delta'; d: ObjectPatchDiff }
	| { t: 'done'; d?: T }
	| { t: 'event'; d: E }

export class StreamEvent<E> {
	constructor(readonly data: E) {}
}

export class StreamReinit<T extends object> {
	constructor(readonly data: T) {}
}

export type ObjectStreamIterable<T extends object, E> = AsyncIterable<
	T | StreamReinit<T> | StreamEvent<E>
>

export interface ObjectStreamResponseInit extends NDJSONStreamResponseInit {
	sendDataOnDone?: boolean
	compressed?: boolean
}

/**
 * Differential Context Protocol Stream
 */
export class ObjectStreamResponse<T extends object, E = any> extends NdJSONStreamResponse<
	ObjectStream<T, E> | CompressedObjectStream<T, E>
> {
	constructor(stream: ObjectStreamIterable<T, E>, init?: ObjectStreamResponseInit) {
		async function* wrapped(): AsyncIterable<ObjectStream<T, E>> {
			let last: T | undefined = undefined
			for await (const chunk of stream) {
				// Send custom events
				if (chunk instanceof StreamEvent) {
					yield { t: 'event', d: chunk.data }
					continue
				}

				// Perform reinit
				if (chunk instanceof StreamReinit) last = undefined
				const data = chunk instanceof StreamReinit ? chunk.data : chunk

				if (last === undefined) {
					yield { t: 'init', d: data }
				} else {
					yield { t: 'delta', d: diffCreate<T>(last, data) }
				}

				last = JSON.parse(JSON.stringify(data))
			}

			// Finalize
			yield init?.sendDataOnDone ? { t: 'done', d: last } : { t: 'done' }
		}

		const compress = init?.compressed !== false
		const res = compress ? deflate(wrapped()) : wrapped()
		super(res, {
			...init,
			headers: {
				...init?.headers,
				'X-Diff-Version': compress ? '1; compressed' : '1'
			}
		})
	}
}

export interface ObjectStreamRequestInit<T extends object, E> extends NdJSONFetchRequestInit<
	ObjectStream<T, E> | CompressedObjectStream<T, E>
> {
	// Called for each new data sample received
	onData?: (data: T) => void
	// Called for each custom event received
	onEvent?: (event: E) => void
	// Triggered when new data frames are received
	onFrame?: (frame: ObjectStream<T, E>) => void
	// If the client accepts plain json responses as valid states
	fallbackPlainJson?: boolean
}

export async function* fetchObjectStream<T extends object, E = any>(
	input: string | URL | Request,
	init?: ObjectStreamRequestInit<T, E>
): AsyncIterable<T> {
	const { onEvent, ...ndInit } = init ?? {}
	let done: boolean = false
	let dataValue: T | undefined = undefined

	try {
		const res = fetchNdJSON<CompressedObjectStream<T, E>>(input, ndInit)
		for await (const data of inflate<T, E>(res)) {
			init?.onFrame?.(data)
			if (data.t === 'init') {
				dataValue = data.d
				init?.onData?.(dataValue)
				yield dataValue
			} else if (data.t === 'delta') {
				dataValue = diffApply<T>(dataValue, data.d)
				init?.onData?.(dataValue)
				yield dataValue
			} else if (data.t === 'event') {
				onEvent?.(data.d)
			} else if (data.t === 'done') {
				if (data.d !== undefined) dataValue = data.d
				done = true
			}
		}
	} catch (error) {
		// Treat `application/json` as the final data response. This makes it
		// easier to treat legacy APIs as DCP streaming ones
		if (error instanceof PlainJsonError && init?.fallbackPlainJson !== false) {
			return error.data
		} else {
			throw error
		}
	}

	// Finalize the stream.
	if (!dataValue) {
		throw Error(`Object stream ended without any data`)
	} else if (!done) {
		throw Error(`Object stream ended without done signal`)
	}
	return dataValue
}
