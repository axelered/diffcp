import { useEffect, useState } from 'react'
import type { ExampleTextState } from './exampleTextApi.ts'
import { fetchObjectStream } from '../core/stream.ts'

export function ExampleText() {
	const [state, setState] = useState<ExampleTextState>()
	useEffect(() => {
		;(async () => {
			for await (const message of fetchObjectStream<ExampleTextState>('/api')) {
				setState(message)
			}
		})().catch(console.error)
	}, [])

	return <div className='rounded bg-gray-300 p-4'>{state?.text}</div>
}
