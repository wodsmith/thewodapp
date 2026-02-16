import {ulid} from 'ulid'
import type {Database} from '../db'
import {sessions, sessionMessages} from '../db/schema'

interface StoreSessionInput {
	userId?: string
	messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>
	metadata?: Record<string, unknown>
}

export async function storeSessionMessages(
	db: Database,
	data: StoreSessionInput,
): Promise<{sessionId: string}> {
	const sessionId = ulid()

	await db.insert(sessions).values({
		id: sessionId,
		userId: data.userId ?? null,
		metadata: data.metadata ?? null,
	})

	if (data.messages.length > 0) {
		const rows = data.messages.map((msg, idx) => ({
			id: ulid(),
			sessionId,
			ordinal: idx,
			role: msg.role,
			content: msg.content,
		}))

		// D1 has a 100 SQL parameter limit. Each row has 5 columns (75 params),
		// so batch conservatively in chunks of 15 to stay well under.
		const BATCH_SIZE = 15
		for (let i = 0; i < rows.length; i += BATCH_SIZE) {
			await db.insert(sessionMessages).values(rows.slice(i, i + BATCH_SIZE))
		}
	}

	return {sessionId}
}
