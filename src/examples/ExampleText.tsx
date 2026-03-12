import { useEffect, useState } from 'react'
import { fetchNdJSON } from '../core/ndjson.ts'

export function ExampleText() {
	const [state, setState] = useState<string[]>([])
	useEffect(() => {
		;(async () => {
			for await (const message of fetchNdJSON<any>('/api')) {
				setState((v) => [...v, JSON.stringify(message)])
			}
		})().catch(console.error)
	}, [])

	return (
		<div className='rounded bg-gray-300 p-4'>
			{state.map((item, index) => (
				<div key={index}>{item}</div>
			))}
		</div>
	)
}
