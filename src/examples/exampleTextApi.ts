import { streamText } from './utils.ts'

const text = `Integer faucibus lectus turpis, ac sollicitudin neque tempus vel. Ut leo elit, ullamcorper sed mattis sed, faucibus eget arcu. Curabitur egestas nisi et libero molestie imperdiet. Quisque ut nulla eget nulla accumsan auctor ut et nibh. Vestibulum tempor justo quam, sed consequat enim interdum ac. Etiam sed commodo erat. Duis blandit, purus vel luctus gravida, lectus leo pellentesque tellus, ac fermentum quam est ac augue. Curabitur ut nunc maximus diam hendrerit faucibus vehicula nec ante. Vivamus mattis posuere est quis facilisis. Sed elementum interdum sapien, et imperdiet justo hendrerit ac. Maecenas in leo ut eros finibus scelerisque. Etiam efficitur imperdiet aliquet. Morbi mattis, leo quis convallis iaculis, eros quam gravida enim, in semper dui metus a lorem. Aliquam in vestibulum nisl, in elementum justo.`

export interface ExampleTextState {
	text: string
}

export async function* exampleTextApi(): AsyncIterable<ExampleTextState> {
	const msg: ExampleTextState = { text: '' }
	for await (const ch of streamText(text)) {
		msg.text = ch
		yield msg
	}
}
