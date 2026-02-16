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
		await db.insert(sessionMessages).values(
			data.messages.map((msg) => ({
				id: ulid(),
				sessionId,
				role: msg.role,
				content: msg.content,
			})),
		)
	}

	return {sessionId}
}
