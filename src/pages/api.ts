export const prerender = false

import { ObjectStreamResponse } from '../core/stream.ts'
import { exampleTextApi } from '../examples/exampleTextApi.ts'

export function GET({ request }: { request: Request }) {
	const compressed = new URL(request.url).searchParams.has('compressed')
	console.log(request.url)
	return new ObjectStreamResponse(exampleTextApi(), { compressed })
}
