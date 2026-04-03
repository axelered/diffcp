import { ObjectStreamResponse } from '@diffcp/core'
import { exampleTextApi } from '../examples/exampleTextApi.ts'

export const prerender = false

export function GET({ request }: { request: Request }) {
  const compressed = new URL(request.url).searchParams.has('compressed')
  console.log(request.url)
  return new ObjectStreamResponse(exampleTextApi(), { compressed })
}
