# ☄️ Diffcp for React

Diffcp (Differential Context Protocol) is the new standard to stream AI Agent state to the user interface. Is a
lightweight alternative to any bespoke AI protocol currently in the industry. Purpose built to be versatile
unopinionated and highly efficient (95%+ compression).

- [Documentation](https://github.com/axelered/diffcp)
- [GitHub](https://github.com/axelered/diffcp)
- [Issues](https://github.com/axelered/diffcp/issues)

## Install

```shell
npm i @diffcp/react
```

## Use

Stream a Diffcp endpoint and render it using the dedicated hook.

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
