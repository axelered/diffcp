import type { ExampleTextState } from './exampleTextApi.ts'
import { AppMessage } from './AppMessage.tsx'
import { useObjectStream } from '../react/useObjectStream.ts'
import { AppButton } from './AppButton.tsx'
import { AppInlineReference } from './AppInlineReference.tsx'
import { AppWebsiteBadge } from './AppWebsiteBadge.tsx'
import { BrainIcon, CloudIcon, CloudRainIcon, SunIcon } from 'lucide-react'
import { AppStageBadge } from './AppStageBadge.tsx'
import { useState } from 'react'

export function ExampleText() {
	const initSizes = { data: 0, frame: 0 } as const
	const [sizes, setSizes] = useState<{ data: number; frame: number }>(initSizes)

	const { submitSync, stop, reset, value, count } = useObjectStream<ExampleTextState>({
		url: '/api',
		onData: (data) => {
			setSizes((s) => ({ ...s, data: s.data + JSON.stringify(data).length }))
		},
		onFrame: (frame) => {
			setSizes((s) => ({ ...s, frame: s.frame + JSON.stringify(frame).length }))
		}
	})

	// Compute size

	return (
		<div className='flex flex-col gap-4'>
			<div className='mb-4 flex items-center justify-end gap-2'>
				<div className='mr-auto text-xs'>
					<span>{count} updates </span>
					<span>{(sizes.data / 1024).toFixed(1)} kB </span>
					<span>{(sizes.frame / 1024).toFixed(1)} kB </span>
					<span>{((1 - sizes.frame / sizes.data) * 100).toFixed(0)}% compression</span>
				</div>
				<AppButton
					onClick={() => {
						setSizes(initSizes)
						submitSync()
					}}
				>
					Send
				</AppButton>
				<AppButton onClick={() => stop()}>Stop</AppButton>
				<AppButton
					onClick={() => {
						setSizes(initSizes)
						reset()
					}}
				>
					Reset
				</AppButton>
			</div>
			{value?.question && <AppMessage role='user'>{value?.question}</AppMessage>}
			{value?.thinking && (
				<AppStageBadge
					className='self-start'
					icon={<BrainIcon />}
					label='Thinking...'
					state='idle'
				/>
			)}
			{value?.parts && (
				<AppMessage
					badgesHead={
						<div className='flex items-center gap-2'>
							{value?.meteo?.weather === 'sun' && (
								<div className='rounded-sm bg-amber-100 p-2 text-amber-600'>
									<SunIcon />
								</div>
							)}
							{value?.meteo?.weather === 'cloud' && (
								<div className='rounded-sm bg-gray-100 p-2 text-gray-600'>
									<CloudIcon />
								</div>
							)}
							{value?.meteo?.weather === 'rain' && (
								<div className='rounded-sm bg-blue-100 p-2 text-blue-600'>
									<CloudRainIcon />
								</div>
							)}
							<div className='flex min-w-24 flex-col pr-4 leading-4'>
								<span className='-mt-1 text-lg font-semibold text-gray-900'>
									{(value?.meteo?.temp ?? 0).toFixed(1)} °C
								</span>
								<span className='text-xs text-gray-500'>{value?.meteo?.place}</span>
							</div>
						</div>
					}
					badgesFooter={
						<>
							{value?.references?.map((ref) => (
								<AppWebsiteBadge
									key={ref.id}
									index={ref.id}
									name={ref.citedText}
									domain={ref.source}
								/>
							))}
							<div className='mt-2 inline-flex w-full justify-end gap-2 text-xs text-gray-500'>
								<span>Tokens: {value?.tokens}</span>
								<span>Price: {value?.price?.toFixed(2)}$</span>
							</div>
						</>
					}
				>
					{value?.parts.map((part, i) => (
						<span key={i} className={part.ref && 'font-bold'}>
							{part.text}
							{part.ref && <AppInlineReference n={part.ref} />}
						</span>
					))}
				</AppMessage>
			)}
		</div>
	)
}
