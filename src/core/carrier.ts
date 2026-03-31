import { NdJSONCodec, type StreamCodec } from './ndjson.ts'

export interface StreamResponseInit<M> extends ResponseInit {
	// Interval between heartbeats
	heartbeatMs?: number
	// Encoding class to pack the messages
	codec?: StreamCodec<M>
}

/**
 * New line delimited JSON response stream
 */
export class StreamResponse<M> extends Response {
	constructor(messages: AsyncIterable<M>, init?: StreamResponseInit<M>) {
		const codec = init?.codec ?? new NdJSONCodec()
		let heartbeat: any = null
		const stream = new ReadableStream({
			async start(controller) {
				// Keep the connection alive
				heartbeat = setInterval(() => {
					controller.enqueue(codec.heartbeat)
				}, init?.heartbeatMs ?? 15_000)

				// Stream out messages
				for await (const buff of codec.encode(messages)) {
					controller.enqueue(buff)
				}

				// Clear
				clearInterval(heartbeat)
				controller.close()
			},
			cancel() {
				clearInterval(heartbeat)
			}
		})

		super(stream, {
			...init,
			headers: {
				'Content-Type': codec.contentType,
				'Transfer-Encoding': 'chunked',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no', // Disable nginx buffering
				...init?.headers
			}
		})
	}
}

function parseContentType(value: string): [string, string] {
	const [typePart, ...paramParts] = value.split(';')
	const type = typePart.trim().toLowerCase()
	const parameters: Record<string, string> = {}
	for (const part of paramParts) {
		const [key, ...rest] = part.split('=')
		if (!key || rest.length === 0) continue
		let val = rest.join('=').trim()
		if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
		parameters[key.trim().toLowerCase()] = val
	}
	return [type, parameters['charset'] || 'utf8']
}

export interface FetchStreamInit<M> extends RequestInit {
	// Encoding class to pack the messages
	codec?: StreamCodec<M>
}

/**
 * New line delimited JSON fetch implementation
 */
export async function* fetchStream<M>(
	input: string | URL | Request,
	init?: FetchStreamInit<M>
): AsyncIterable<M> {
	const res = await fetch(input, init)

	if (!res.ok) {
		throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
	} else if (!res.body) {
		throw new Error(`fetch failed: empty request body`)
	}

	const ctHeader = res.headers.get('content-type')
	const [type, encoding] = parseContentType(ctHeader ?? '')

	const codec = init?.codec ?? new NdJSONCodec()
	if (codec.supportedContentTypes.includes(type)) {
		yield* codec.decode(res.body, type, encoding)
	} else {
		// Unknown format
		throw new Error(`fetch failed: invalid response content type ${ctHeader}`)
	}
}
