# ☄️ Diffcp Core

Diffcp (Differential Context Protocol) is the new standard to stream AI Agent state to the user interface. Is a
lightweight alternative to any bespoke AI protocol currently in the industry. Purpose built to be versatile
unopinionated and highly efficient (95%+ compression).

- [GitHub](https://github.com/axelered/diffcp)
- [Issues](https://github.com/axelered/diffcp/issues)

## Install

```shell
npm i @diffcp/core
```

## Use

Convert your existing APIs to a streaming endpoint with a **one line** and a simple function which
**yield updated state objects**. Then on the client just **consume an updating state stream**

```ts
export interface MessageType {
  text: string
}

export async function* streamMessage(): AsyncIterable<MessageType> {
  yield { text: 'This' }
  yield { text: 'This is' }
  // ...
  yield { text: 'This is a stream message completed' }
}

// On the server
export function GET() {
  return new ObjectStreamResponse(streamMessage())
}

// On the client
for await (const data of fetchObjectStream<MessageType>('/api')) {
  // ...
}
```

## `ObjectStreamResponse`

```ts
function ObjectStreamResponse<T, E>(
  stream: ObjectStreamIterable<T, E>,
  init?: ObjectStreamResponseInit
): Response
```

Response implementation for the Differential Context Protocol (DCP).

#### Parameters

| Field    | Type                         | Description         |
| -------- | ---------------------------- | ------------------- |
| `stream` | `ObjectStreamIterable<T, E>` | Object/event stream |
| `init`   | `ObjectStreamResponseInit`   | Stream options      |

#### `init: ObjectStreamResponseInit`

| Field            | Type      | Description                          |
| ---------------- | --------- | ------------------------------------ |
| `sendDataOnDone` | `boolean` | Send final state on completion       |
| `compressed`     | `boolean` | Enable compression. Default: `true`  |
| `heartbeatMs`    | `number`  | Heartbeat interval. Default: `15000` |

#### Returns `Response`

| Type       | Description            |
| ---------- | ---------------------- |
| `Response` | DCP streaming response |

### Example

```ts
export async function* streamMessage(): AsyncIterable<MessageType> {
  yield { text: 'This' }
  yield { text: 'This is' }
  // ...
  yield { text: 'This is a stream message completed' }
}

export function GET() {
  return new ObjectStreamResponse(streamMessage())
}
```

## `fetchObjectStream`

```ts
function fetchObjectStream<T, E>(
  input: string | URL | Request,
  init?: ObjectStreamRequestInit<T, E>
): AsyncIterable<T>
```

Fetches and processes a DCP object stream.

#### Parameters

| Field   | Type                            | Description            |
| ------- | ------------------------------- | ---------------------- |
| `input` | `string \| URL \| Request`      | Request target         |
| `init`  | `ObjectStreamRequestInit<T, E>` | Fetch + stream options |

#### `init: ObjectStreamRequestInit<T, E>`

| Field               | Type                                  | Description                                         |
| ------------------- | ------------------------------------- | --------------------------------------------------- |
| `onData`            | `(data: T) => void`                   | Called per data update                              |
| `onEvent`           | `(event: E) => void`                  | Called per custom event                             |
| `onFrame`           | `(frame: ObjectStream<T, E>) => void` | Called per frame (`init`, `delta`, `event`, `done`) |
| `fallbackPlainJson` | `boolean`                             | Accept plain JSON. Default: `true`                  |

#### Returns `AsyncIterable<T>`

| Type               | Description                        |
| ------------------ | ---------------------------------- |
| `AsyncIterable<T>` | Yields reconstructed object states |

### Example

```ts
for await (const data of fetchObjectStream<MessageType>('/api')) {
  // Consume data
}
```

## `NdJSONStreamResponse`

```ts
function NdJSONStreamResponse<M>(
  messages: AsyncIterable<M>,
  init?: NDJSONStreamResponseInit
): Response
```

Streams newline-delimited JSON messages.

#### Parameters

| Field      | Type                       | Description        |
| ---------- | -------------------------- | ------------------ |
| `messages` | `AsyncIterable<M>`         | Messages to stream |
| `init`     | `NDJSONStreamResponseInit` | Response options   |

#### `init: NDJSONStreamResponseInit`

| Field         | Type     | Description                          |
| ------------- | -------- | ------------------------------------ |
| `heartbeatMs` | `number` | Heartbeat interval. Default: `15000` |

#### Returns `Response`

| Type       | Description                       |
| ---------- | --------------------------------- |
| `Response` | Web-compatible streaming response |

## `fetchNdJSON`

```ts
function fetchNdJSON<T>(
  input: string | URL | Request,
  init?: NdJSONFetchRequestInit<T>
): AsyncIterable<T>
```

Fetches and parses an NDJSON stream.

#### Parameters

| Field   | Type                        | Description    |
| ------- | --------------------------- | -------------- |
| `input` | `string \| URL \| Request`  | Request target |
| `init`  | `NdJSONFetchRequestInit<T>` | Fetch options  |

#### `init: NdJSONFetchRequestInit<T>`

| Field    | Type                 | Description                 |
| -------- | -------------------- | --------------------------- |
| `onLine` | `(value: T) => void` | Called per parsed JSON line |

#### Returns `AsyncIterable<T>`

| Type               | Description                |
| ------------------ | -------------------------- |
| `AsyncIterable<T>` | Yields parsed JSON objects |

#### Notes

- Async generator
- Throws `PlainJsonError` for `application/json` responses

## `diffCreate`

```ts
function diffCreate<T>(from: T | undefined, to: T): ObjectPatchDiff
```

Creates a set of diff operations to transition from one object state to another.

#### Parameters

| Field  | Type             | Description          |
| ------ | ---------------- | -------------------- |
| `from` | `T \| undefined` | Initial object state |
| `to`   | `T`              | Target object state  |

#### Returns `ObjectPatchDiff`

| Type              | Description               |
| ----------------- | ------------------------- |
| `ObjectPatchDiff` | Array of patch operations |

## `diffApply`

```ts
function diffApply<T>(value: T | undefined, diff: ObjectPatchDiff): T
```

Applies diff operations to produce a new object state.

#### Parameters

| Field   | Type              | Description          |
| ------- | ----------------- | -------------------- |
| `value` | `T \| undefined`  | Current object state |
| `diff`  | `ObjectPatchDiff` | Patch operations     |

#### Returns `T`

| Type | Description      |
| ---- | ---------------- |
| `T`  | New object state |
