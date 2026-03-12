import { NdJSONStreamResponse } from '../core/ndjson.ts'

export function wait(time: number) {
	return new Promise((resolve) => setTimeout(resolve, time))
}

export function GET() {
	async function* data() {
		for (let i = 0; i < 20; i++) {
			yield { text: `Message ${i}` }
			await wait(1_000)
		}
	}

	return new NdJSONStreamResponse(data())
}
