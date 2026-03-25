import type { ExampleTextState } from './exampleTextApi.ts'
import { AppMessage } from './AppMessage.tsx'
import { useObjectStream } from '../react/useObjectStream.ts'
import { AppButton } from './AppButton.tsx'

export function ExampleText() {
	const { submitSync, stop, reset, value } = useObjectStream<ExampleTextState>({
		url: '/api',
		initialValue: { text: '' }
	})

	return (
		<div>
			<div className='mb-4 flex justify-end gap-2'>
				<AppButton onClick={() => submitSync()}>Send</AppButton>
				<AppButton onClick={() => stop()}>Stop</AppButton>
				<AppButton onClick={() => reset()}>Reset</AppButton>
			</div>
			<AppMessage>{value?.text}</AppMessage>
		</div>
	)
}
