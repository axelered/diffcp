import { useCallback, useRef, useState } from 'react'
import { fetchObjectStream } from '../core/stream.ts'

export interface UseObjectStreamOption<T extends object> {
	url?: string
	method?: RequestInit['method']
	initialValue?: T | undefined
	// Keep stale value during submissions. Used to reduce flickering
	keepStale?: boolean
	// Keep the intermediate value when stopped
	keepOnStop?: boolean
	// Handle custom events being dispatched in the stream
	onEvent?: (value: any) => void
}

export interface UseObjectStreamReturn<T extends object, R> {
	status: 'idle' | 'submitted' | 'streaming' | 'stopped' | 'done' | 'error'
	value: T | undefined
	count: number
	error: Error | undefined
	// Submit the request and optionally wait for the final answer. Fails on
	// error and returns undefined if aborted
	submit: (body?: R | Request) => Promise<T | undefined>
	// Like submit but resolves sync and returns the abort function
	submitSync: (body?: R | Request) => void // () => void
	// Abort any currently ongoing request
	stop: () => void
	// Reset the status
	reset: () => void
	// Utility status flags
	isIdle: boolean
	isSubmitted: boolean
	isStreaming: boolean
	isStopped: boolean
	isDone: boolean
	isError: boolean
	// Meta status flags
	isPending: boolean // submitted, streaming
	isCompleted: boolean // stopped, done, error
}

type InnerStatus<T extends object, R> = Pick<
	UseObjectStreamReturn<T, R>,
	'status' | 'value' | 'count' | 'error'
>

export function useObjectStream<T extends object, R = any>(
	options: UseObjectStreamOption<T>
): UseObjectStreamReturn<T, R> {
	const resetValue = {
		status: 'idle',
		value: options?.initialValue,
		count: 0,
		error: undefined
	} as const

	const [value, setValue] = useState<InnerStatus<T, R>>(resetValue)
	const ref = useRef<AbortController | null>(null)

	const reset = useCallback(() => {
		if (ref.current) {
			ref.current.abort()
			ref.current = null
		}
		setValue(resetValue)
	}, [options.initialValue, setValue])

	const stop = useCallback(() => {
		if (ref.current) {
			ref.current?.abort()
			ref.current = null
			setValue((prev) => ({
				...prev,
				status: 'stopped'
			}))
		}
	}, [setValue])

	const submit = useCallback(
		async (body?: R | Request): Promise<T | undefined> => {
			ref.current?.abort()

			const abortController = new AbortController()
			ref.current = abortController

			try {
				setValue((old) => ({
					status: 'submitted',
					value: options?.keepStale ? old.value : undefined,
					count: 0,
					error: undefined
				}))

				// Prepare the request
				let request: Request
				if (body instanceof Request) {
					request = body as Request
				} else if (options.url) {
					request = new Request(options.url, {
						method: options.method || 'GET',
						headers: new Headers({
							'content-type': 'application/json'
						}),
						body: body !== undefined ? (JSON.stringify(body) as any) : undefined,
						signal: abortController.signal
					})
				} else {
					throw Error('Url must be set on the hook when submitting a body object')
				}

				// Consume the stream
				let count = 0
				let lastData: T | undefined = undefined
				for await (const data of fetchObjectStream<T>(request)) {
					count += 1
					setValue({ status: 'streaming', value: data, count, error: undefined })
					lastData = data
				}
				if (lastData !== undefined) {
					setValue({ status: 'done', value: lastData, count, error: undefined })
				}

				return lastData
			} catch (e) {
				if (abortController.signal.aborted) {
					if (options?.keepOnStop === false) setValue(resetValue)
					return undefined
				} else {
					setValue({ status: 'error', value: undefined, count: 0, error: e as any })
					throw e
				}
			} finally {
				ref.current = null
			}
		},
		[setValue]
	)

	const submitSync = useCallback(
		(body?: R | Request) => {
			submit(body).catch(() => {})
			// return stop
		},
		[stop, submit]
	)

	return {
		...value,
		submit,
		submitSync,
		stop,
		reset,
		isIdle: value.status === 'idle',
		isSubmitted: value.status === 'submitted',
		isStreaming: value.status === 'streaming',
		isStopped: value.status === 'stopped',
		isDone: value.status === 'done',
		isError: value.status === 'error',
		isPending: value.status === 'submitted' || value.status === 'streaming',
		isCompleted: value.status === 'stopped' || value.status === 'done' || value.status === 'error'
	}
}
