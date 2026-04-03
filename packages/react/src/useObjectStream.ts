import { useCallback, useRef, useState } from 'react'
import { fetchObjectStream, type ObjectStreamRequestInit } from '@diffcp/core'

export type UseObjectStreamOption<T extends object> = {
  /** URL of the DCP stream endpoint. */
  url?: string
  /** HTTP method to use for the request. Defaults to GET. */
  method?: RequestInit['method']
  /** Initial value of the object before any data is received. */
  initialValue?: T | undefined
  /** Keep the stale value during new submissions to reduce flickering. */
  keepStale?: boolean
  /** Keep the intermediate value when the stream is stopped. */
  keepOnStop?: boolean
} & ObjectStreamRequestInit<T, any>

export interface UseObjectStreamReturn<T extends object, R> {
  /** Current status of the stream. */
  status: 'idle' | 'submitted' | 'streaming' | 'stopped' | 'done' | 'error'
  /** Current value of the object being streamed. */
  value: T | undefined
  /** Number of frames received. */
  count: number
  /** Error if the stream failed. */
  error: Error | undefined
  /**
   * Submits a new request.
   *
   * @param body - Optional request body or Request object.
   * @returns A promise that resolves to the final object state.
   */
  submit: (body?: R | Request) => Promise<T | undefined>
  /**
   * Submits a new request without returning a promise.
   *
   * @param body - Optional request body or Request object.
   */
  submitSync: (body?: R | Request) => void
  /** Aborts the current request. */
  stop: () => void
  /** Resets the hook state to idle and initial value. */
  reset: () => void
  /** True if the status is idle. */
  isIdle: boolean
  /** True if the request has been submitted but no data received yet. */
  isSubmitted: boolean
  /** True if data is currently being streamed. */
  isStreaming: boolean
  /** True if the stream was manually stopped. */
  isStopped: boolean
  /** True if the stream completed successfully. */
  isDone: boolean
  /** True if an error occurred. */
  isError: boolean
  /** True if the stream is currently active (submitted or streaming). */
  isPending: boolean
  /** True if the stream has finished (stopped, done, or error). */
  isCompleted: boolean
}

type InnerStatus<T extends object, R> = Pick<
  UseObjectStreamReturn<T, R>,
  'status' | 'value' | 'count' | 'error'
>

/**
 * A React hook for consuming DCP object streams.
 *
 * @param options - Configuration for the stream and fetch request.
 * @returns An object containing the stream state and control functions.
 */
export function useObjectStream<T extends object, R = any>({
  url,
  method,
  initialValue,
  keepStale,
  keepOnStop,
  ...fetchOptions
}: UseObjectStreamOption<T>): UseObjectStreamReturn<T, R> {
  const resetValue = {
    status: 'idle',
    value: initialValue,
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
  }, [initialValue, setValue])

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
          value: keepStale ? old.value : undefined,
          count: 0,
          error: undefined
        }))

        // Prepare the request
        let request: Request
        if (body instanceof Request) {
          request = body as Request
        } else if (url) {
          request = new Request(url, {
            method: method || 'GET',
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
        for await (const data of fetchObjectStream<T>(request, fetchOptions)) {
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
          if (keepOnStop === false) setValue(resetValue)
          return undefined
        } else {
          setValue({ status: 'error', value: undefined, count: 0, error: e as any })
          throw e
        }
      } finally {
        ref.current = null
      }
    },
    [setValue, url, method]
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
