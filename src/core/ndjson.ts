import { decodeMultiStream, Encoder } from '@msgpack/msgpack'

/**
 * Streaming encoding abstraction
 */
export interface StreamCodec<M> {
	readonly contentType: string
	readonly supportedContentTypes: string[]
	readonly heartbeat: Uint8Array
	encode(messages: AsyncIterable<M>): AsyncIterable<Uint8Array>
	decode(stream: ReadableStream<Uint8Array>, type: string, encoding: string): AsyncIterable<M>
}

/**
 * Internal error used to signal a fallback of a plain JSON response
 */
export class PlainJsonError extends Error {
	constructor(public readonly data: any) {
		super('fetch failed: received plain application/json response')
	}
}

/**
 * Plain NdJSON codec
 */
export class NdJSONCodec<M> implements StreamCodec<M> {
	readonly contentType = 'application/x-ndjson; charset=utf-8'
	readonly supportedContentTypes = ['application/x-ndjson', 'application/json']
	readonly heartbeat: Uint8Array = new Uint8Array([10])

	async *encode(messages: AsyncIterable<M>): AsyncIterable<Uint8Array> {
		const encoder = new TextEncoder()
		for await (const msg of messages) {
			yield encoder.encode(JSON.stringify(msg) + '\n')
		}
	}

	async *decode(
		stream: ReadableStream<Uint8Array>,
		type: string,
		encoding: string
	): AsyncIterable<M> {
		const reader = stream.getReader()
		const decoder = new TextDecoder(encoding)
		let buffer = ''

		if (type === 'application/x-ndjson') {
			// Stream the JSON
			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split('\n')
				buffer = lines.pop() ?? ''
				for (const line of lines) {
					const trimmed = line.trim()
					if (!trimmed) continue // Ignore empty lines
					yield JSON.parse(trimmed) as M
				}
			}

			// Flush any remaining line
			const tail = buffer.trim()
			if (tail) yield JSON.parse(tail) as M
		} else {
			// Fail but conserve the data, may be used as fallback
			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })
			}
			throw new PlainJsonError(JSON.parse(buffer))
		}
	}
}

/**
 * MessagePack codec
 */
export class MessagePackCodec<M> implements StreamCodec<M> {
	readonly contentType = 'application/msgpack'
	readonly supportedContentTypes = ['application/msgpack']
	readonly heartbeat: Uint8Array = new Uint8Array([0xc0]) // null

	async *encode(messages: AsyncIterable<M>): AsyncIterable<Uint8Array> {
		const encoder = new Encoder()
		for await (const msg of messages) {
			yield encoder.encode(msg)
		}
	}

	async *decode(stream: ReadableStream<Uint8Array>): AsyncIterable<M> {
		for await (const value of decodeMultiStream(stream)) {
			if (value == null) continue
			yield value as M
		}
	}
}
