const MODEL = '@cf/baai/bge-small-en-v1.5'

export async function generateEmbedding(
	ai: Ai,
	text: string,
): Promise<number[]> {
	const result = await ai.run(MODEL, {text: [text]})
	if (!('data' in result) || !result.data) {
		throw new Error('Embedding model returned no data')
	}
	return result.data[0]
}
