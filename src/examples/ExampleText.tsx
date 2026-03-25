import { useEffect, useState } from 'react'
import type { ExampleTextState } from './exampleTextApi.ts'
import { fetchObjectStream } from '../core/stream.ts'
import { AppMessage } from './AppMessage.tsx'

export function ExampleText() {
	const [state, setState] = useState<ExampleTextState>()
	useEffect(() => {
		;(async () => {
			for await (const message of fetchObjectStream<ExampleTextState>('/api')) {
				setState(message)
			}
		})().catch(console.error)
	}, [])

	return <AppMessage>{state?.text}</AppMessage>
}
