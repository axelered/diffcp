import { streamText, wait } from './utils.ts'

const data = {
	question: `What is the average income density per square kilometer in paris?`,
	answer: [
		`There is no direct statistic for “income density per square kilometer” for `,
		`<ref id="1">Paris</ref> on Wikipedia. However, it can be approximated using `,
		`available data. Paris has a GDP of about <ref id="2">€279.938 billion</ref> `,
		`and an area of <ref id="3">105.4 km²</ref>, which implies a very high economic `,
		`output per unit area. This corresponds to an approximate economic density of about `,
		`<ref id="4">€2.65 billion per km²</ref> when dividing total GDP by land area `,
		`(derived calculation based on cited figures).`
	].join(''),
	references: [
		{
			id: '1',
			source: 'en.wikipedia.org',
			citedText: 'Paris'
		},
		{
			id: '2',
			source: 'en.wikipedia.org',
			citedText: 'Paris GDP'
		},
		{
			id: '3',
			source: 'en.wikipedia.org',
			citedText: 'Paris Area'
		},
		{
			id: '4',
			source: 'en.wikipedia.org',
			citedText: 'GDP figures France'
		}
	]
}

// Function to inefficiently extract references
function splitParts(text: string): ExampleTextPart[] {
	const re = /<ref(?:\s+id="([^"]+)")?>(.*?)<\/ref>/gs
	const out: ExampleTextPart[] = []
	let i = 0
	let m: RegExpExecArray | null
	while ((m = re.exec(text))) {
		if (m.index > i) out.push({ text: text.slice(i, m.index) })
		out.push({ ref: m[1], text: m[2] })
		i = re.lastIndex
	}
	if (i < text.length) out.push({ text: text.slice(i) })
	return out
}

// Function to inefficiently retrieve references
function getCitedReferences(parts: ExampleTextPart[]): ExampleTextReferences[] {
	const s = new Set(parts.map((p) => p.ref))
	return data.references.filter((r) => s.has(r.id))
}

// Function to fake token count
function countTokens(text: string) {
	return text
		.split(/\s+/g)
		.map((w) => Math.ceil(w.length / 4))
		.reduce((a, b) => a + b, 0)
}

// Function to fake meteo
function meteoStream(place: string) {
	let temp = 15.1
	return () => {
		if (Math.random() > 0.9) temp += 0.2
		return {
			place,
			temp,
			weather: temp < 15.6 ? 'rain' : temp < 17 ? 'cloud' : 'sun'
		} as ExampleMeteoFeed
	}
}

export interface ExampleMeteoFeed {
	place: string
	temp: number
	weather: 'sun' | 'rain' | 'cloud'
}

export interface ExampleTextPart {
	ref?: string
	text: string
}

export interface ExampleTextReferences {
	id: string
	source: string
	citedText: string
}

export interface ExampleTextState {
	thinking?: boolean
	question: string
	text?: string
	parts?: ExampleTextPart[]
	references?: ExampleTextReferences[]
	tokens?: number
	price?: number
	meteo?: ExampleMeteoFeed
}

export async function* exampleTextApi(): AsyncIterable<ExampleTextState> {
	const res: ExampleTextState = { thinking: true, question: data.question }
	yield res
	await wait(1200)
	// Produce response
	let i = 0
	const meteo = meteoStream('Paris South')
	for await (const ch of streamText(data.answer)) {
		res.thinking = false
		res.text = ch
		res.parts = splitParts(ch)
		res.references = getCitedReferences(res.parts)
		// Update at a slower rate
		if (i++ % 10 === 0) {
			res.tokens = countTokens(ch)
			res.price = res.tokens * 0.0001
		}
		// Stream with an internal update rate
		res.meteo = meteo()
		yield res
	}
	// Final update
	res.tokens = countTokens(res.text ?? '')
	res.price = res.tokens * 0.0001
	res.meteo = meteo()
}
