import {sql} from 'drizzle-orm'
import {integer, real, sqliteTable, text} from 'drizzle-orm/sqlite-core'

export const observations = sqliteTable('observations', {
	id: text('id').primaryKey(),
	content: text('content').notNull(),
	category: text('category', {
		enum: ['convention', 'gotcha', 'debugging', 'architecture', 'workflow'],
	}).notNull(),
	priority: text('priority', {
		enum: ['critical', 'moderate', 'ephemeral'],
	}).notNull(),
	score: real('score').notNull().default(1.0),
	maturity: text('maturity', {
		enum: ['candidate', 'established', 'proven', 'deprecated'],
	})
		.notNull()
		.default('candidate'),
	retrievalCount: integer('retrieval_count').notNull().default(0),
	userId: text('user_id'),
	sessionId: text('session_id'),
	condensed: integer('condensed', {mode: 'boolean'}).notNull().default(false),
	feedbackLog: text('feedback_log', {mode: 'json'}).$type<
		Array<{signal: string; note?: string; at: string}>
	>(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
})

export const reflections = sqliteTable('reflections', {
	id: text('id').primaryKey(),
	content: text('content').notNull(),
	category: text('category', {
		enum: ['convention', 'gotcha', 'debugging', 'architecture', 'workflow'],
	}).notNull(),
	priority: text('priority', {
		enum: ['critical', 'moderate', 'ephemeral'],
	}).notNull(),
	score: real('score').notNull().default(1.0),
	maturity: text('maturity', {
		enum: ['candidate', 'established', 'proven', 'deprecated'],
	})
		.notNull()
		.default('candidate'),
	sourceObservationIds: text('source_observation_ids', {
		mode: 'json',
	}).$type<string[]>(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
})

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id'),
	startedAt: text('started_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	metadata: text('metadata', {mode: 'json'}).$type<Record<string, unknown>>(),
})

export const sessionMessages = sqliteTable('session_messages', {
	id: text('id').primaryKey(),
	sessionId: text('session_id').notNull(),
	ordinal: integer('ordinal').notNull(),
	role: text('role', {enum: ['user', 'assistant', 'system']}).notNull(),
	content: text('content').notNull(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
})

// Type exports
export type Observation = typeof observations.$inferSelect
export type NewObservation = typeof observations.$inferInsert
export type Reflection = typeof reflections.$inferSelect
export type NewReflection = typeof reflections.$inferInsert
export type Session = typeof sessions.$inferSelect
export type SessionMessage = typeof sessionMessages.$inferSelect

export type Category = Observation['category']
export type Priority = Observation['priority']
export type Maturity = Observation['maturity']
export type FeedbackSignal = 'helpful' | 'harmful' | 'irrelevant'
