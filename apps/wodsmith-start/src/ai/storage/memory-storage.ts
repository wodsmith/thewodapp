/**
 * MySQL/PlanetScale implementation of Mastra MemoryStorage.
 *
 * Port of MemoryStorageD1 from @mastra/cloudflare-d1, adapted for MySQL.
 */

import {
	MemoryStorage,
	TABLE_SCHEMAS,
	TABLE_THREADS,
	TABLE_MESSAGES,
	TABLE_RESOURCES,
	ensureDate,
	normalizePerPage,
	calculatePagination,
} from "@mastra/core/storage"
import type {
	StorageResourceType,
	StorageListMessagesInput,
	StorageListMessagesOutput,
	StorageListThreadsInput,
	StorageListThreadsOutput,
} from "@mastra/core/storage"
import { MessageList } from "@mastra/core/agent"
import type { MastraMessageContentV2 } from "@mastra/core/agent"
import type { MastraDBMessage, StorageThreadType } from "@mastra/core/memory"

import { MysqlDB, toMySQLDatetime } from "./mysql-db"

function isArrayOfRecords(
	value: unknown,
): value is Record<string, unknown>[] {
	return value !== null && Array.isArray(value) && value.length > 0
}

function deserializeValue(value: unknown): unknown {
	if (value === null || value === undefined) return null
	if (
		typeof value === "string" &&
		(value.startsWith("{") || value.startsWith("["))
	) {
		try {
			return JSON.parse(value)
		} catch {
			return value
		}
	}
	return value
}

/**
 * Strip providerMetadata from reasoning parts in message content.
 *
 * Works around a Mastra core bug where the first response's reasoning
 * providerMetadata (containing an OpenAI `rs_xxx` itemId) leaks into
 * subsequent assistant messages. When these stale itemIds are replayed
 * to OpenAI's Responses API, it rejects with "Duplicate item found".
 *
 * By stripping providerMetadata from stored reasoning, OpenAI generates
 * fresh reasoning IDs for each request.
 */
function stripReasoningProviderMetadata(content: unknown): unknown {
	if (typeof content === "string") {
		try {
			const parsed = JSON.parse(content)
			const stripped = stripReasoningProviderMetadata(parsed)
			return JSON.stringify(stripped)
		} catch {
			return content
		}
	}
	if (typeof content !== "object" || content === null) return content

	const obj = content as Record<string, unknown>
	if (Array.isArray(obj.parts)) {
		return {
			...obj,
			parts: (obj.parts as Record<string, unknown>[]).map((part) => {
				if (part.type === "reasoning") {
					const { providerMetadata, ...rest } = part
					return rest
				}
				return part
			}),
		}
	}
	return content
}

interface MemoryStorageMySQLConfig {
	url: string
	tablePrefix?: string
}

export class MemoryStorageMySQL extends MemoryStorage {
	#db: MysqlDB

	constructor(config: MemoryStorageMySQLConfig) {
		super()
		this.#db = new MysqlDB({
			url: config.url,
			tablePrefix: config.tablePrefix,
		})
	}

	async init() {
		await this.#db.createTable({
			tableName: TABLE_THREADS,
			schema: TABLE_SCHEMAS[TABLE_THREADS],
		})
		await this.#db.createTable({
			tableName: TABLE_MESSAGES,
			schema: TABLE_SCHEMAS[TABLE_MESSAGES],
		})
		await this.#db.createTable({
			tableName: TABLE_RESOURCES,
			schema: TABLE_SCHEMAS[TABLE_RESOURCES],
		})
		await this.#db.alterTable({
			tableName: TABLE_MESSAGES,
			schema: TABLE_SCHEMAS[TABLE_MESSAGES],
			ifNotExists: ["resourceId"],
		})
	}

	async dangerouslyClearAll() {
		await this.#db.clearTable({ tableName: TABLE_MESSAGES })
		await this.#db.clearTable({ tableName: TABLE_THREADS })
		await this.#db.clearTable({ tableName: TABLE_RESOURCES })
	}

	async getResourceById({
		resourceId,
	}: { resourceId: string }): Promise<StorageResourceType | null> {
		const resource = await this.#db.load({
			tableName: TABLE_RESOURCES,
			keys: { id: resourceId },
		})
		if (!resource) return null

		return {
			...resource,
			id: resource.id as string,
			workingMemory: resource.workingMemory as string | undefined,
			createdAt: ensureDate(resource.createdAt as string | Date | undefined)!,
			updatedAt: ensureDate(resource.updatedAt as string | Date | undefined)!,
			metadata:
				typeof resource.metadata === "string"
					? JSON.parse(resource.metadata || "{}")
					: (resource.metadata as Record<string, unknown>),
		}
	}

	async saveResource({
		resource,
	}: { resource: StorageResourceType }): Promise<StorageResourceType> {
		await this.#db.upsert({
			tableName: TABLE_RESOURCES,
			record: {
				id: resource.id,
				workingMemory: resource.workingMemory,
				metadata: resource.metadata
					? JSON.stringify(resource.metadata)
					: null,
				createdAt: resource.createdAt,
				updatedAt: resource.updatedAt,
			},
			conflictColumns: ["id"],
			updateColumns: [
				"workingMemory",
				"metadata",
				"createdAt",
				"updatedAt",
			],
		})
		return resource
	}

	async updateResource({
		resourceId,
		workingMemory,
		metadata,
	}: {
		resourceId: string
		workingMemory?: string
		metadata?: Record<string, unknown>
	}): Promise<StorageResourceType> {
		const existingResource = await this.getResourceById({ resourceId })

		if (!existingResource) {
			const newResource: StorageResourceType = {
				id: resourceId,
				workingMemory,
				metadata: metadata || {},
				createdAt: new Date(),
				updatedAt: new Date(),
			}
			return this.saveResource({ resource: newResource })
		}

		const updatedAt = new Date()
		const updatedResource: StorageResourceType = {
			...existingResource,
			workingMemory:
				workingMemory !== undefined
					? workingMemory
					: existingResource.workingMemory,
			metadata: {
				...existingResource.metadata,
				...metadata,
			},
			updatedAt,
		}

		const fullTableName = this.#db.getTableName(TABLE_RESOURCES)
		await this.#db.executeQuery({
			sql: `UPDATE \`${fullTableName}\` SET \`workingMemory\` = ?, \`metadata\` = ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
			params: [
				updatedResource.workingMemory,
				JSON.stringify(updatedResource.metadata),
				toMySQLDatetime(updatedAt),
				resourceId,
			],
		})
		return updatedResource
	}

	async getThreadById({
		threadId,
	}: { threadId: string }): Promise<StorageThreadType | null> {
		const thread = await this.#db.load({
			tableName: TABLE_THREADS,
			keys: { id: threadId },
		})
		if (!thread) return null

		return {
			...thread,
			id: thread.id as string,
			resourceId: thread.resourceId as string,
			title: thread.title as string,
			createdAt: ensureDate(thread.createdAt as string | Date | undefined)!,
			updatedAt: ensureDate(thread.updatedAt as string | Date | undefined)!,
			metadata:
				typeof thread.metadata === "string"
					? JSON.parse(thread.metadata || "{}")
					: (thread.metadata as Record<string, unknown>) || {},
		}
	}

	async listThreads(
		args: StorageListThreadsInput,
	): Promise<StorageListThreadsOutput> {
		const { filter, page = 0, perPage: perPageInput, orderBy } = args
		const perPage = normalizePerPage(perPageInput, 100)
		const { offset, perPage: perPageForResponse } = calculatePagination(
			page,
			perPageInput,
			perPage,
		)
		const { field, direction } = this.parseOrderBy(orderBy)

		const fullTableName = this.#db.getTableName(TABLE_THREADS)

		// Build WHERE clause from filter
		const conditions: string[] = []
		const params: unknown[] = []

		if (filter?.resourceId) {
			conditions.push("`resourceId` = ?")
			params.push(filter.resourceId)
		}

		if (filter?.metadata) {
			for (const [key, value] of Object.entries(filter.metadata)) {
				conditions.push(`JSON_EXTRACT(\`metadata\`, ?) = ?`)
				params.push(`$.${key}`, typeof value === "string" ? value : JSON.stringify(value))
			}
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		const countResult = await this.#db.executeQuery({
			sql: `SELECT COUNT(*) AS count FROM \`${fullTableName}\` ${whereClause}`,
			params,
		})
		const total = Number(
			(countResult as Record<string, unknown>[])?.[0]?.count ?? 0,
		)

		const limitValue = perPageInput === false ? total : perPage
		const results = await this.#db.executeQuery({
			sql: `SELECT * FROM \`${fullTableName}\` ${whereClause} ORDER BY \`${field}\` ${direction} LIMIT ? OFFSET ?`,
			params: [...params, limitValue, offset],
		})

		const threads = (results as Record<string, unknown>[]).map(
			(row) =>
				({
					...row,
					createdAt: ensureDate(row.createdAt as string | Date | undefined)!,
					updatedAt: ensureDate(row.updatedAt as string | Date | undefined)!,
					metadata:
						typeof row.metadata === "string"
							? JSON.parse(row.metadata || "{}")
							: row.metadata || {},
				}) as StorageThreadType,
		)

		return {
			threads,
			total,
			page,
			perPage: perPageForResponse,
			hasMore:
				perPageInput === false ? false : offset + perPage < total,
		}
	}

	async saveThread({
		thread,
	}: { thread: StorageThreadType }): Promise<StorageThreadType> {
		await this.#db.upsert({
			tableName: TABLE_THREADS,
			record: {
				id: thread.id,
				resourceId: thread.resourceId,
				title: thread.title,
				metadata: thread.metadata
					? JSON.stringify(thread.metadata)
					: null,
				createdAt: toMySQLDatetime(thread.createdAt),
				updatedAt: toMySQLDatetime(thread.updatedAt),
			},
			conflictColumns: ["id"],
			updateColumns: [
				"resourceId",
				"title",
				"metadata",
				"createdAt",
				"updatedAt",
			],
		})
		return thread
	}

	async updateThread({
		id,
		title,
		metadata,
	}: {
		id: string
		title: string
		metadata: Record<string, unknown>
	}): Promise<StorageThreadType> {
		const thread = await this.getThreadById({ threadId: id })
		if (!thread) {
			throw new Error(`Thread ${id} not found`)
		}

		const mergedMetadata = {
			...(typeof thread.metadata === "string"
				? JSON.parse(thread.metadata)
				: thread.metadata),
			...metadata,
		}
		const updatedAt = new Date()

		const fullTableName = this.#db.getTableName(TABLE_THREADS)
		await this.#db.executeQuery({
			sql: `UPDATE \`${fullTableName}\` SET \`title\` = ?, \`metadata\` = ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
			params: [
				title,
				JSON.stringify(mergedMetadata),
				toMySQLDatetime(updatedAt),
				id,
			],
		})

		return {
			...thread,
			title,
			metadata: mergedMetadata,
			updatedAt,
		}
	}

	async deleteThread({ threadId }: { threadId: string }) {
		const threadsTable = this.#db.getTableName(TABLE_THREADS)
		const messagesTable = this.#db.getTableName(TABLE_MESSAGES)

		await this.#db.executeQuery({
			sql: `DELETE FROM \`${threadsTable}\` WHERE \`id\` = ?`,
			params: [threadId],
		})
		await this.#db.executeQuery({
			sql: `DELETE FROM \`${messagesTable}\` WHERE \`thread_id\` = ?`,
			params: [threadId],
		})
	}

	async saveMessages(args: {
		messages: MastraDBMessage[]
	}): Promise<{ messages: MastraDBMessage[] }> {
		const { messages } = args
		if (messages.length === 0) return { messages: [] }

		const now = new Date()
		const threadId = messages[0]?.threadId

		for (const [i, message] of messages.entries()) {
			if (!message.id) throw new Error(`Message at index ${i} missing id`)
			if (!message.threadId)
				throw new Error(`Message at index ${i} missing threadId`)
			if (!message.content)
				throw new Error(`Message at index ${i} missing content`)
			if (!message.role)
				throw new Error(`Message at index ${i} missing role`)
			if (!message.resourceId)
				throw new Error(`Message at index ${i} missing resourceId`)

			const thread = await this.getThreadById({
				threadId: message.threadId,
			})
			if (!thread) throw new Error(`Thread ${message.threadId} not found`)
		}

		// Deduplicate: fetch existing message IDs for this thread so we can
		// skip messages whose content already exists (prevents the Mastra
		// providerMetadata leak from creating duplicate assistant messages).
		const fullTableName = this.#db.getTableName(TABLE_MESSAGES)
		const existingRows = await this.#db.executeQuery({
			sql: `SELECT id, content FROM \`${fullTableName}\` WHERE \`thread_id\` = ?`,
			params: [threadId],
		})
		const existingById = new Map<string, string>()
		const existingContentSet = new Set<string>()
		if (Array.isArray(existingRows)) {
			for (const row of existingRows as { id: string; content: string }[]) {
				existingById.set(row.id, row.content)
				existingContentSet.add(row.content)
			}
		}

		const messagesToInsert: Array<{
			id: string
			thread_id: string
			content: string
			createdAt: string
			role: string
			type: string
			resourceId: string
		}> = []

		for (const message of messages) {
			const contentStr =
				typeof message.content === "string"
					? message.content
					: JSON.stringify(message.content)
			const createdAt = message.createdAt
				? new Date(message.createdAt)
				: now

			// If this exact ID already exists, allow upsert (update)
			if (existingById.has(message.id)) {
				messagesToInsert.push({
					id: message.id,
					thread_id: message.threadId,
					content: contentStr,
					createdAt: toMySQLDatetime(createdAt),
					role: message.role,
					type: message.type || "v2",
					resourceId: message.resourceId,
				})
				continue
			}

			// Skip if identical content already exists in this thread
			// (prevents duplicate assistant messages from providerMetadata leak)
			if (existingContentSet.has(contentStr)) {
				continue
			}

			messagesToInsert.push({
				id: message.id,
				thread_id: message.threadId,
				content: contentStr,
				createdAt: toMySQLDatetime(createdAt),
				role: message.role,
				type: message.type || "v2",
				resourceId: message.resourceId,
			})
			// Track so subsequent messages in this batch are also deduped
			existingContentSet.add(contentStr)
		}

		if (messagesToInsert.length > 0) {
			await this.#db.batchUpsert({
				tableName: TABLE_MESSAGES,
				records: messagesToInsert,
			})
		}

		// Update thread's updatedAt timestamp
		const threadsTable = this.#db.getTableName(TABLE_THREADS)
		await this.#db.executeQuery({
			sql: `UPDATE \`${threadsTable}\` SET \`updatedAt\` = ? WHERE \`id\` = ?`,
			params: [toMySQLDatetime(now), threadId],
		})

		const list = new MessageList().add(messages, "memory")
		return { messages: list.get.all.db() }
	}

	private async _getIncludedMessages(
		include: StorageListMessagesInput["include"],
	): Promise<Record<string, unknown>[] | null> {
		if (!include || include.length === 0) return null

		const tableName = this.#db.getTableName(TABLE_MESSAGES)
		const unionQueries: string[] = []
		const params: unknown[] = []

		for (const [idx, inc] of include.entries()) {
			const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc

			unionQueries.push(`
				SELECT * FROM (
					WITH target_thread AS (
						SELECT thread_id FROM \`${tableName}\` WHERE id = ?
					),
					ordered_messages AS (
						SELECT
							*,
							ROW_NUMBER() OVER (ORDER BY createdAt ASC) AS row_num
						FROM \`${tableName}\`
						WHERE thread_id = (SELECT thread_id FROM target_thread)
					)
					SELECT
						m.id,
						m.content,
						m.role,
						m.type,
						m.createdAt,
						m.thread_id AS threadId,
						m.resourceId
					FROM ordered_messages m
					WHERE m.id = ?
					OR EXISTS (
						SELECT 1 FROM ordered_messages target
						WHERE target.id = ?
						AND (
							(m.row_num <= target.row_num + ? AND m.row_num > target.row_num)
							OR
							(m.row_num >= target.row_num - ? AND m.row_num < target.row_num)
						)
					)
				) AS query_${idx + 1}
			`)
			params.push(id, id, id, withNextMessages, withPreviousMessages)
		}

		const finalQuery =
			unionQueries.join(" UNION ALL ") + " ORDER BY createdAt ASC"
		const messages = await this.#db.executeQuery({
			sql: finalQuery,
			params,
		})

		if (!Array.isArray(messages)) return []

		return (messages as Record<string, unknown>[]).map((message) => {
			const processedMsg: Record<string, unknown> = {}
			for (const [key, value] of Object.entries(message)) {
				if (key === "type" && value === "v2") continue
				processedMsg[key] = deserializeValue(value)
			}
			return processedMsg
		})
	}

	async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{
		messages: MastraDBMessage[]
	}> {
		if (messageIds.length === 0) return { messages: [] }

		const fullTableName = this.#db.getTableName(TABLE_MESSAGES)
		const placeholders = messageIds.map(() => "?").join(",")

		const result = await this.#db.executeQuery({
			sql: `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM \`${fullTableName}\` WHERE id IN (${placeholders}) ORDER BY \`createdAt\` DESC`,
			params: messageIds,
		})

		const messages = Array.isArray(result)
			? (result as Record<string, unknown>[])
			: []
		const processedMessages = messages.map((message) => {
			const processedMsg: Record<string, unknown> = {}
			for (const [key, value] of Object.entries(message)) {
				if (key === "type" && value === "v2") continue
				if (key === "content") {
					processedMsg[key] = stripReasoningProviderMetadata(
						deserializeValue(value),
					)
				} else {
					processedMsg[key] = deserializeValue(value)
				}
			}
			return processedMsg
		})

		const list = new MessageList().add(
			processedMessages as MastraDBMessage[],
			"memory",
		)
		return { messages: list.get.all.db() }
	}

	async listMessages(
		args: StorageListMessagesInput,
	): Promise<StorageListMessagesOutput> {
		const {
			threadId,
			resourceId,
			include,
			filter,
			perPage: perPageInput,
			page = 0,
			orderBy,
		} = args
		const threadIds = Array.isArray(threadId) ? threadId : [threadId]

		if (threadIds.length === 0 || threadIds.some((id) => !id.trim())) {
			throw new Error(
				"threadId must be a non-empty string or array of non-empty strings",
			)
		}

		const perPage = normalizePerPage(perPageInput, 40)
		const { offset, perPage: perPageForResponse } = calculatePagination(
			page,
			perPageInput,
			perPage,
		)

		const fullTableName = this.#db.getTableName(TABLE_MESSAGES)
		let query = `
			SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId
			FROM \`${fullTableName}\`
			WHERE \`thread_id\` = ?
		`
		const queryParams: unknown[] = [threadId]

		if (resourceId) {
			query += ` AND \`resourceId\` = ?`
			queryParams.push(resourceId)
		}

		const dateRange = filter?.dateRange
		if (dateRange?.start) {
			const startDate = toMySQLDatetime(
				dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start),
			)
			const startOp = dateRange.startExclusive ? ">" : ">="
			query += ` AND \`createdAt\` ${startOp} ?`
			queryParams.push(startDate)
		}
		if (dateRange?.end) {
			const endDate = toMySQLDatetime(
				dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end),
			)
			const endOp = dateRange.endExclusive ? "<" : "<="
			query += ` AND \`createdAt\` ${endOp} ?`
			queryParams.push(endDate)
		}

		const { field, direction } = this.parseOrderBy(orderBy, "ASC")
		query += ` ORDER BY \`${field}\` ${direction}`

		if (perPage !== Number.MAX_SAFE_INTEGER) {
			query += ` LIMIT ? OFFSET ?`
			queryParams.push(perPage, offset)
		}

		const results = await this.#db.executeQuery({
			sql: query,
			params: queryParams,
		})
		const paginatedMessages = (
			isArrayOfRecords(results) ? results : []
		).map((message: Record<string, unknown>) => {
			const processedMsg: Record<string, unknown> = {}
			for (const [key, value] of Object.entries(message)) {
				if (key === "type" && value === "v2") continue
				if (key === "content") {
					// Strip stale reasoning providerMetadata to prevent
					// duplicate rs_ itemIds when replayed to OpenAI
					processedMsg[key] = stripReasoningProviderMetadata(
						deserializeValue(value),
					)
				} else {
					processedMsg[key] = deserializeValue(value)
				}
			}
			return processedMsg
		})

		const paginatedCount = paginatedMessages.length

		// Count query
		let countQuery = `SELECT COUNT(*) as count FROM \`${fullTableName}\` WHERE \`thread_id\` = ?`
		const countParams: unknown[] = [threadId]

		if (resourceId) {
			countQuery += ` AND \`resourceId\` = ?`
			countParams.push(resourceId)
		}
		if (dateRange?.start) {
			const startDate = toMySQLDatetime(
				dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start),
			)
			const startOp = dateRange.startExclusive ? ">" : ">="
			countQuery += ` AND \`createdAt\` ${startOp} ?`
			countParams.push(startDate)
		}
		if (dateRange?.end) {
			const endDate = toMySQLDatetime(
				dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end),
			)
			const endOp = dateRange.endExclusive ? "<" : "<="
			countQuery += ` AND \`createdAt\` ${endOp} ?`
			countParams.push(endDate)
		}

		const countResult = await this.#db.executeQuery({
			sql: countQuery,
			params: countParams,
		})
		const total = Number(
			(countResult as Record<string, unknown>[])[0]?.count ?? 0,
		)

		if (
			total === 0 &&
			paginatedCount === 0 &&
			(!include || include.length === 0)
		) {
			return {
				messages: [],
				total: 0,
				page,
				perPage: perPageForResponse,
				hasMore: false,
			}
		}

		// Handle included messages
		const messageIds = new Set(
			paginatedMessages.map(
				(m: Record<string, unknown>) => m.id as string,
			),
		)
		if (include && include.length > 0) {
			const includeResult = await this._getIncludedMessages(include)
			if (Array.isArray(includeResult)) {
				for (const includeMsg of includeResult) {
					if (!messageIds.has(includeMsg.id as string)) {
						paginatedMessages.push(includeMsg)
						messageIds.add(includeMsg.id as string)
					}
				}
			}
		}

		const list = new MessageList().add(
			paginatedMessages as MastraDBMessage[],
			"memory",
		)
		let finalMessages = list.get.all.db()

		finalMessages = finalMessages.sort((a, b) => {
			const isDateField = field === "createdAt" || field === "updatedAt"
			const aRaw = (a as Record<string, unknown>)[field]
			const bRaw = (b as Record<string, unknown>)[field]
			const aValue = isDateField
				? new Date(aRaw as string).getTime()
				: aRaw
			const bValue = isDateField
				? new Date(bRaw as string).getTime()
				: bRaw

			if (aValue === bValue) {
				return String(a.id).localeCompare(String(b.id))
			}

			if (typeof aValue === "number" && typeof bValue === "number") {
				return direction === "ASC"
					? aValue - bValue
					: bValue - aValue
			}
			return direction === "ASC"
				? String(aValue).localeCompare(String(bValue))
				: String(bValue).localeCompare(String(aValue))
		})

		const returnedThreadMessageIds = new Set(
			finalMessages
				.filter((m) => m.threadId === threadId)
				.map((m) => m.id),
		)
		const allThreadMessagesReturned =
			returnedThreadMessageIds.size >= total
		const hasMore =
			perPageInput === false
				? false
				: allThreadMessagesReturned
					? false
					: offset + paginatedCount < total

		return {
			messages: finalMessages,
			total,
			page,
			perPage: perPageForResponse,
			hasMore,
		}
	}

	async updateMessages(args: {
		messages: (Partial<Omit<MastraDBMessage, "createdAt">> & {
			id: string
			content?: {
				metadata?: MastraMessageContentV2["metadata"]
				content?: MastraMessageContentV2["content"]
			}
		})[]
	}): Promise<MastraDBMessage[]> {
		const { messages } = args
		if (!messages.length) return []

		const messageIds = messages.map((m) => m.id)
		const fullTableName = this.#db.getTableName(TABLE_MESSAGES)
		const threadsTableName = this.#db.getTableName(TABLE_THREADS)

		const placeholders = messageIds.map(() => "?").join(",")
		const selectQuery = `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM \`${fullTableName}\` WHERE id IN (${placeholders})`
		const existingMessages = (await this.#db.executeQuery({
			sql: selectQuery,
			params: messageIds,
		})) as Record<string, unknown>[]

		if (existingMessages.length === 0) return []

		const parsedExistingMessages = existingMessages.map((msg) => {
			if (typeof msg.content === "string") {
				try {
					msg.content = JSON.parse(msg.content as string)
				} catch {
					// keep as string
				}
			}
			return msg
		})

		const threadIdsToUpdate = new Set<string>()
		const updateQueries: { sql: string; params: unknown[] }[] = []

		for (const existingMessage of parsedExistingMessages) {
			const updatePayload = messages.find(
				(m) => m.id === existingMessage.id,
			)
			if (!updatePayload) continue

			const { id, ...fieldsToUpdate } = updatePayload
			if (Object.keys(fieldsToUpdate).length === 0) continue

			threadIdsToUpdate.add(existingMessage.threadId as string)

			if (
				"threadId" in updatePayload &&
				updatePayload.threadId &&
				updatePayload.threadId !== existingMessage.threadId
			) {
				threadIdsToUpdate.add(updatePayload.threadId)
			}

			const setClauses: string[] = []
			const values: unknown[] = []
			const updatableFields = { ...fieldsToUpdate } as Record<
				string,
				unknown
			>

			if (updatableFields.content) {
				const existingContent =
					(existingMessage.content as Record<string, unknown>) || {}
				const updateContent = updatableFields.content as Record<
					string,
					unknown
				>
				const newContent = {
					...existingContent,
					...updateContent,
					...(existingContent?.metadata && updateContent.metadata
						? {
								metadata: {
									...(existingContent.metadata as Record<
										string,
										unknown
									>),
									...(updateContent.metadata as Record<
										string,
										unknown
									>),
								},
							}
						: {}),
				}
				setClauses.push("`content` = ?")
				values.push(JSON.stringify(newContent))
				delete updatableFields.content
			}

			for (const key in updatableFields) {
				if (
					Object.prototype.hasOwnProperty.call(updatableFields, key)
				) {
					const dbColumn =
						key === "threadId" ? "thread_id" : key
					setClauses.push(`\`${dbColumn}\` = ?`)
					values.push(updatableFields[key])
				}
			}

			if (setClauses.length > 0) {
				values.push(id)
				updateQueries.push({
					sql: `UPDATE \`${fullTableName}\` SET ${setClauses.join(", ")} WHERE \`id\` = ?`,
					params: values,
				})
			}
		}

		for (const query of updateQueries) {
			await this.#db.executeQuery(query)
		}

		if (threadIdsToUpdate.size > 0) {
			const threadPlaceholders = Array.from(threadIdsToUpdate)
				.map(() => "?")
				.join(",")
			await this.#db.executeQuery({
				sql: `UPDATE \`${threadsTableName}\` SET \`updatedAt\` = ? WHERE \`id\` IN (${threadPlaceholders})`,
				params: [
					toMySQLDatetime(new Date()),
					...Array.from(threadIdsToUpdate),
				],
			})
		}

		const updatedMessages = (await this.#db.executeQuery({
			sql: selectQuery,
			params: messageIds,
		})) as Record<string, unknown>[]

		return updatedMessages.map((message) => {
			if (typeof message.content === "string") {
				try {
					message.content = JSON.parse(message.content as string)
				} catch {
					// keep as string
				}
			}
			return message as unknown as MastraDBMessage
		})
	}

	async deleteMessages(messageIds: string[]) {
		if (messageIds.length === 0) return

		const fullTableName = this.#db.getTableName(TABLE_MESSAGES)
		const threadsTableName = this.#db.getTableName(TABLE_THREADS)
		const placeholders = messageIds.map(() => "?").join(",")

		// Get affected thread IDs
		const threadResults = (await this.#db.executeQuery({
			sql: `SELECT DISTINCT thread_id FROM \`${fullTableName}\` WHERE id IN (${placeholders})`,
			params: messageIds,
		})) as Record<string, unknown>[]
		const threadIds = threadResults
			.map((r) => r.thread_id as string)
			.filter(Boolean)

		// Delete messages
		await this.#db.executeQuery({
			sql: `DELETE FROM \`${fullTableName}\` WHERE id IN (${placeholders})`,
			params: messageIds,
		})

		// Update thread timestamps
		if (threadIds.length > 0) {
			const threadPlaceholders = threadIds.map(() => "?").join(",")
			await this.#db.executeQuery({
				sql: `UPDATE \`${threadsTableName}\` SET \`updatedAt\` = ? WHERE \`id\` IN (${threadPlaceholders})`,
				params: [toMySQLDatetime(new Date()), ...threadIds],
			})
		}
	}
}
