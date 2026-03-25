export function wait(time: number) {
	return new Promise((resolve) => setTimeout(resolve, time))
}

export interface StreamTextOptions {
	chunkSize?: number
	interval?: number
}

export async function* streamText(
	text: string,
	{ interval = 100, chunkSize = 5 }: StreamTextOptions = {}
) {
	for (let i = 0; i < text.length; i += chunkSize) {
		yield text.substring(0, i + chunkSize)
		await wait(interval)
	}
}
