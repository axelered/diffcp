# ☄️ Diffcp Core

Diffcp (Differential Context Protocol) is the new standard to stream AI Agent state to the user interface. Is a
lightweight alternative to any bespoke AI protocol currently in the industry. Purpose built to be versatile
unopinionated and highly efficient (95%+ compression).

- [Documentation](https://github.com/axelered/diffcp)
- [GitHub](https://github.com/axelered/diffcp)
- [Issues](https://github.com/axelered/diffcp/issues)

## Install

```shell
npm i @diffcp/core
```

## Use

Convert your existing APIs to a streaming endpoint with a **one line** and a simple function which
**yield updated state objects**

```ts
export interface MessageType {
	text: string
}
```

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

On the client just **consume an updating state stream**

```ts
for await (const data of fetchObjectStream<MessageType>('/api')) {
	// Consume data
}
```
