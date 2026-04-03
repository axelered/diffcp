# ☄️ Diffcp for React

Diffcp (Differential Context Protocol) is the new standard to stream AI Agent state to the user interface. Is a
lightweight alternative to any bespoke AI protocol currently in the industry. Purpose built to be versatile
unopinionated and highly efficient (95%+ compression).

- [GitHub](https://github.com/axelered/diffcp)
- [Issues](https://github.com/axelered/diffcp/issues)

## Install

```shell
npm i @diffcp/react
```

## `useObjectStream`

```ts
function useObjectStream<T, E = unknown, R = unknown>(
  options: UseObjectStreamOption<T, E, R>
): UseObjectStreamReturn<T, R>
```

React hook for consuming DCP object streams with built-in state management and control APIs.

#### `options: UseObjectStreamOption<T, E, R>`

| Field               | Type                                  | Default | Description                                             |
| ------------------- | ------------------------------------- | ------- | ------------------------------------------------------- |
| `url`               | `string`                              |         | DCP stream endpoint                                     |
| `method`            | `RequestInit['method']`               | `GET`   | HTTP method. Default: `GET`                             |
| `initialValue`      | `T \| undefined`                      |         | Initial object value before data arrives                |
| `keepStale`         | `boolean`                             | `false` | Preserve previous value during new submissions          |
| `keepOnStop`        | `boolean`                             | `true`  | Preserve intermediate value when stopped                |
| `onData`            | `(data: T) => void`                   |         | Called on each data sample                              |
| `onEvent`           | `(event: E) => void`                  |         | Called on each custom event                             |
| `onFrame`           | `(frame: ObjectStream<T, E>) => void` |         | Called on each frame (`init`, `delta`, `event`, `done`) |
| `fallbackPlainJson` | `boolean`                             | `true`  | Accept plain JSON responses. Default: `true`            |

#### Returns `UseObjectStreamReturn<T, R>`

| Field         | Type                                                                     | Description                |
| ------------- | ------------------------------------------------------------------------ | -------------------------- |
| `status`      | `'idle' \| 'submitted' \| 'streaming' \| 'stopped' \| 'done' \| 'error'` | Current stream state       |
| `value`       | `T \| undefined`                                                         | Current streamed value     |
| `count`       | `number`                                                                 | Number of frames received  |
| `error`       | `Error \| undefined`                                                     | Stream error               |
| `submit`      | `(body?: R \| Request) => Promise<T \| undefined>`                       | Submit request (async)     |
| `submitSync`  | `(body?: R \| Request) => void`                                          | Submit request (sync)      |
| `stop`        | `() => void`                                                             | Abort active stream        |
| `reset`       | `() => void`                                                             | Reset to initial state     |
| `isIdle`      | `boolean`                                                                | `status === 'idle'`        |
| `isSubmitted` | `boolean`                                                                | `status === 'submitted'`   |
| `isStreaming` | `boolean`                                                                | `status === 'streaming'`   |
| `isStopped`   | `boolean`                                                                | `status === 'stopped'`     |
| `isDone`      | `boolean`                                                                | `status === 'done'`        |
| `isError`     | `boolean`                                                                | `status === 'error'`       |
| `isPending`   | `boolean`                                                                | `submitted` or `streaming` |
| `isCompleted` | `boolean`                                                                | `done` or `error`          |

### Example

```tsx
import { useObjectStream } from '@diffcp/react'

export function StreamText() {
  const { submitSync, value } = useObjectStream<{ text: string }>({
    url: '/api'
  })
  return (
    <main className=''>
      <button onClick={() => submitSync()}>Send</button>
      <div className=''>{value?.text}</div>
    </main>
  )
}
```
