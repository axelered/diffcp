import { diffApply, diffCreate, type ObjectPatchDiff } from './diff.ts'
import {
	fetchStream,
	type FetchStreamInit,
	StreamResponse,
	type StreamResponseInit
} from './carrier.ts'
import { PlainJsonError } from './ndjson.ts'
import { Compressor } from './compress.ts'

export type ObjectStreamInit<T> = { t: 'init'; d: T }
export type ObjectStreamDelta = { t: 'delta'; d: ObjectPatchDiff }
export type ObjectStreamDone<T> = { t: 'done'; d?: T }
export type ObjectStreamEvent<E> = { t: 'event'; d: E }

export type ObjectStream<T extends object, E> =
	| ObjectStreamInit<T>
	| ObjectStreamDelta
	| ObjectStreamDone<T>
	| ObjectStreamEvent<E>

export class StreamEvent<E> {
	constructor(readonly data: E) {}
}

export class StreamReinit<T extends object> {
	constructor(readonly data: T) {}
}

export type ObjectStreamIterable<T extends object, E> = AsyncIterable<
	T | StreamReinit<T> | StreamEvent<E>
>

export interface ObjectStreamResponseInit<T extends object, E> extends StreamResponseInit<
	ObjectStream<T, E>
> {
	sendDataOnDone?: boolean
	compressor?: Compressor<T, E>
}

/**
 * Differential Context Protocol Stream
 */
export class ObjectStreamResponse<T extends object, E = any> extends StreamResponse<
	ObjectStream<T, E>
> {
	constructor(stream: ObjectStreamIterable<T, E>, init?: ObjectStreamResponseInit<T, E>) {
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

		const compr = init?.compressor ?? new Compressor()
		super(compr.deflate(wrapped()), {
			...init,
			headers: {
				...init?.headers,
				'X-Diff-Version': '1'
			}
		})
	}
}

export interface ObjectStreamRequestInit<T extends object, E> extends FetchStreamInit<
	ObjectStream<T, E>
> {
	onFrame?: (frame: ObjectStream<T, E>) => void
	onEvent?: (event: E) => void
	fallbackPlainJson?: boolean
	compressor?: Compressor<T, E>
}

export async function* fetchObjectStream<T extends object, E = any>(
	input: string | URL | Request,
	init?: ObjectStreamRequestInit<T, E>
): AsyncIterable<T> {
	const { onEvent, ...ndInit } = init ?? {}
	let done: boolean = false
	let dataValue: T | undefined = undefined

	const compr = init?.compressor ?? new Compressor()
	try {
		for await (const data of compr.inflate(fetchStream<ObjectStream<T, E>>(input, ndInit))) {
			init?.onFrame?.(data)
			if (data.t === 'init') {
				dataValue = data.d
				yield dataValue
			} else if (data.t === 'delta') {
				dataValue = diffApply<T>(dataValue, data.d)
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
