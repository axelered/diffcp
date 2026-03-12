export interface NDJSONStreamResponseInit extends ResponseInit {
	// Interval between heartbeats
	heartbeatMs?: number
}

/**
 * New line delimited JSON response stream
 */
export class NdJSONStreamResponse<M> extends Response {
	constructor(messages: AsyncIterable<M>, init?: NDJSONStreamResponseInit) {
		const encoder = new TextEncoder()
		let heartbeat: any = null
		const stream = new ReadableStream({
			async start(controller) {
				// Keep the connection alive
				heartbeat = setInterval(() => {
					controller.enqueue('\n')
				}, init?.heartbeatMs ?? 15_000)

				// Stream out messages
				for await (const msg of messages) {
					controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
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
				'Content-Type': 'application/x-ndjson; charset=utf-8',
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

export async function* fetchNdJSON<T>(
	input: string | URL | Request,
	init?: RequestInit
): AsyncIterable<T> {
	const res = await fetch(input, init)

	if (!res.ok) {
		throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
	} else if (!res.body) {
		throw new Error(`fetch failed: empty request body`)
	}

	const ctHeader = res.headers.get('content-type')
	const [type, encoding] = parseContentType(ctHeader ?? '')

	if (type === 'application/json') {
		// Fall back to plain JSON
		yield await res.json()
	} else if (type === 'application/x-ndjson') {
		// Stream the JSON
		const reader = res.body.getReader()
		const decoder = new TextDecoder(encoding)
		let buffer = ''

		while (true) {
			const { value, done } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() ?? ''
			for (const line of lines) {
				const trimmed = line.trim()
				if (!trimmed) continue // Ignore empty lines
				yield JSON.parse(trimmed) as T
			}
		}

		// Flush any remaining line
		const tail = buffer.trim()
		if (tail) yield JSON.parse(tail) as T
	} else {
		throw new Error(`fetch failed: invalid response content type ${ctHeader}`)
	}
}
