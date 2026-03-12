import { ObjectStreamResponse } from '../core/stream.ts'
import { exampleTextApi } from '../examples/exampleTextApi.ts'

export function GET() {
	return new ObjectStreamResponse(exampleTextApi())
}
