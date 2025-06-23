import { relations } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createProgrammingTrackId,
	createProgrammingTrackPaymentId,
	createScheduledWorkoutInstanceId,
	createTrackWorkoutId,
} from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"
import { workouts } from "./workouts"

// Track types enum & tuple
export const PROGRAMMING_TRACK_TYPE = {
	SELF_PROGRAMMED: "self_programmed",
	TEAM_OWNED: "team_owned",
	OFFICIAL_3RD_PARTY: "official_3rd_party",
} as const

export const programmingTrackTypeTuple = Object.values(
	PROGRAMMING_TRACK_TYPE,
) as [string, ...string[]]

// Pricing types for programming tracks
export const PROGRAMMING_TRACK_PRICING_TYPE = {
	FREE: "free",
	ONE_TIME: "one_time",
	RECURRING: "recurring",
} as const

export const programmingTrackPricingTypeTuple = Object.values(
	PROGRAMMING_TRACK_PRICING_TYPE,
) as [string, ...string[]]

// Recurring billing intervals
export const BILLING_INTERVAL = {
	WEEK: "week",
	MONTH: "month",
	YEAR: "year",
} as const

export const billingIntervalTuple = Object.values(BILLING_INTERVAL) as [
	string,
	...string[],
]

// Programming tracks table
export const programmingTracksTable = sqliteTable(
	"programming_track",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createProgrammingTrackId())
			.notNull(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
		type: text({ enum: programmingTrackTypeTuple }).notNull(),
		ownerTeamId: text().references(() => teamTable.id),
		isPublic: integer().default(0).notNull(),

		// Pricing fields
		pricingType: text({ enum: programmingTrackPricingTypeTuple })
			.default(PROGRAMMING_TRACK_PRICING_TYPE.FREE)
			.notNull(),
		price: integer(), // Price in cents (for Stripe compatibility)
		currency: text({ length: 3 }).default("usd"), // ISO currency code
		billingInterval: text({ enum: billingIntervalTuple }), // Only for recurring payments

		// Stripe integration fields
		stripePriceId: text({ length: 255 }), // Stripe Price ID
		stripeProductId: text({ length: 255 }), // Stripe Product ID

		// Trial period (in days) for recurring subscriptions
		trialPeriodDays: integer().default(0),
	},
	(table) => [
		index("programming_track_type_idx").on(table.type),
		index("programming_track_owner_idx").on(table.ownerTeamId),
		index("programming_track_pricing_type_idx").on(table.pricingType),
		index("programming_track_stripe_price_idx").on(table.stripePriceId),
	],
)

// Team programming tracks (join table) - Enhanced with payment functionality
export const teamProgrammingTracksTable = sqliteTable(
	"team_programming_track",
	{
		...commonColumns,
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		isActive: integer().default(1).notNull(),
		subscribedAt: integer({ mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		// Optional: allow teams to customize their start day within the track
		startDayOffset: integer().default(0).notNull(),

		// Payment tracking fields (moved from user_programming_tracks)
		paymentStatus: text({
			enum: ["pending", "paid", "failed", "cancelled", "refunded"],
		})
			.default("pending")
			.notNull(),
		stripeCustomerId: text({ length: 255 }),
		stripeSubscriptionId: text({ length: 255 }), // For recurring payments
		stripePaymentIntentId: text({ length: 255 }), // For one-time payments
		subscriptionExpiresAt: integer({ mode: "timestamp" }), // For recurring subscriptions
		cancelledAt: integer({ mode: "timestamp" }),
		cancelAtPeriodEnd: integer().default(0).notNull(), // Boolean for graceful subscription cancellation
	},
	(table) => [
		primaryKey({ columns: [table.teamId, table.trackId] }),
		index("team_programming_track_active_idx").on(table.isActive),
		index("team_programming_track_team_idx").on(table.teamId),
		index("team_programming_track_payment_status_idx").on(table.paymentStatus),
		index("team_programming_track_stripe_subscription_idx").on(
			table.stripeSubscriptionId,
		),
		index("team_programming_track_expires_at_idx").on(
			table.subscriptionExpiresAt,
		),
	],
)

// Track workouts
export const trackWorkoutsTable = sqliteTable(
	"track_workout",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTrackWorkoutId())
			.notNull(),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		workoutId: text()
			.notNull()
			.references(() => workouts.id),
		dayNumber: integer().notNull(),
		weekNumber: integer(),
		notes: text({ length: 1000 }),
	},
	(table) => [
		index("track_workout_track_idx").on(table.trackId),
		index("track_workout_day_idx").on(table.dayNumber),
		index("track_workout_workoutid_idx").on(table.workoutId),
		index("track_workout_unique_idx").on(
			table.trackId,
			table.workoutId,
			table.dayNumber,
		),
	],
)

// Scheduled Workout Instances
export const scheduledWorkoutInstancesTable = sqliteTable(
	"scheduled_workout_instance",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createScheduledWorkoutInstanceId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id),
		scheduledDate: integer({ mode: "timestamp" }).notNull(),
		teamSpecificNotes: text({ length: 1000 }),
		scalingGuidanceForDay: text({ length: 1000 }),
		classTimes: text({ length: 500 }), // JSON string or comma-separated times
	},
	(table) => [
		index("scheduled_workout_instance_team_idx").on(table.teamId),
		index("scheduled_workout_instance_date_idx").on(table.scheduledDate),
	],
)

// Programming track payments - Individual payment records
export const programmingTrackPaymentsTable = sqliteTable(
	"programming_track_payment",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createProgrammingTrackPaymentId())
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		amount: integer().notNull(), // Amount in cents
		currency: text({ length: 3 }).notNull(), // ISO currency code
		paymentType: text({
			enum: ["one_time", "recurring"],
		}).notNull(),
		status: text({
			enum: ["pending", "succeeded", "failed", "cancelled", "refunded"],
		}).notNull(),

		// Stripe integration fields
		stripePaymentIntentId: text({ length: 255 }),
		stripeSubscriptionId: text({ length: 255 }),
		stripeInvoiceId: text({ length: 255 }),
		stripeCustomerId: text({ length: 255 }).notNull(),

		// Failure and refund tracking
		failureReason: text({ length: 500 }),
		refundedAt: integer({ mode: "timestamp" }),
		refundAmount: integer(),

		// Billing period (for recurring payments)
		periodStart: integer({ mode: "timestamp" }),
		periodEnd: integer({ mode: "timestamp" }),
	},
	(table) => [
		index("programming_track_payment_user_idx").on(table.userId),
		index("programming_track_payment_track_idx").on(table.trackId),
		index("programming_track_payment_status_idx").on(table.status),
		index("programming_track_payment_stripe_payment_intent_idx").on(
			table.stripePaymentIntentId,
		),
		index("programming_track_payment_stripe_subscription_idx").on(
			table.stripeSubscriptionId,
		),
		index("programming_track_payment_created_at_idx").on(table.createdAt),
	],
)

// Relations
export const programmingTracksRelations = relations(
	programmingTracksTable,
	({ one, many }) => ({
		ownerTeam: one(teamTable, {
			fields: [programmingTracksTable.ownerTeamId],
			references: [teamTable.id],
		}),
		teamProgrammingTracks: many(teamProgrammingTracksTable),
		trackWorkouts: many(trackWorkoutsTable),
		payments: many(programmingTrackPaymentsTable),
	}),
)

export const teamProgrammingTracksRelations = relations(
	teamProgrammingTracksTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamProgrammingTracksTable.teamId],
			references: [teamTable.id],
		}),
		track: one(programmingTracksTable, {
			fields: [teamProgrammingTracksTable.trackId],
			references: [programmingTracksTable.id],
		}),
	}),
)

export const trackWorkoutsRelations = relations(
	trackWorkoutsTable,
	({ one, many }) => ({
		track: one(programmingTracksTable, {
			fields: [trackWorkoutsTable.trackId],
			references: [programmingTracksTable.id],
		}),
		workout: one(workouts, {
			fields: [trackWorkoutsTable.workoutId],
			references: [workouts.id],
		}),
		scheduledInstances: many(scheduledWorkoutInstancesTable),
	}),
)

export const scheduledWorkoutInstancesRelations = relations(
	scheduledWorkoutInstancesTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [scheduledWorkoutInstancesTable.teamId],
			references: [teamTable.id],
		}),
		trackWorkout: one(trackWorkoutsTable, {
			fields: [scheduledWorkoutInstancesTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
	}),
)

export const programmingTrackPaymentsRelations = relations(
	programmingTrackPaymentsTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [programmingTrackPaymentsTable.userId],
			references: [userTable.id],
			relationName: "programmingTrackPayments",
		}),
		track: one(programmingTracksTable, {
			fields: [programmingTrackPaymentsTable.trackId],
			references: [programmingTracksTable.id],
		}),
	}),
)

// Type exports
export type ProgrammingTrack = InferSelectModel<typeof programmingTracksTable>
export type TeamProgrammingTrack = InferSelectModel<
	typeof teamProgrammingTracksTable
>
export type TrackWorkout = InferSelectModel<typeof trackWorkoutsTable>
export type ScheduledWorkoutInstance = InferSelectModel<
	typeof scheduledWorkoutInstancesTable
>
export type ProgrammingTrackPayment = InferSelectModel<
	typeof programmingTrackPaymentsTable
>
