import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, varchar, datetime } from "drizzle-orm/mysql-core"
import { commonColumns, createPasskeyId, createUserId } from "./common"
import { competitionRegistrationsTable } from "./competitions"

// User roles
export const ROLES_ENUM = {
	ADMIN: "admin",
	USER: "user",
} as const

const roleTuple = Object.values(ROLES_ENUM) as [string, ...string[]]

// Gender enum for competition divisions
export const GENDER_ENUM = {
	MALE: "male",
	FEMALE: "female",
} as const

export type Gender = (typeof GENDER_ENUM)[keyof typeof GENDER_ENUM]

const genderTuple = Object.values(GENDER_ENUM) as [string, ...string[]]

// User table
export const userTable = mysqlTable(
	"users",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createUserId())
			.notNull(),
		firstName: varchar({
			length: 255,
		}),
		lastName: varchar({
			length: 255,
		}),
		email: varchar({
			length: 255,
		}).unique(),
		passwordHash: varchar({ length: 255 }),
		role: varchar({
			length: 50,
			enum: roleTuple,
		})
			.default(ROLES_ENUM.USER)
			.notNull(),
		emailVerified: datetime(),
		signUpIpAddress: varchar({
			length: 128,
		}),
		googleAccountId: varchar({
			length: 255,
		}),
		/**
		 * This can either be an absolute or relative path to an image
		 */
		avatar: varchar({
			length: 600,
		}),
		// Credit system fields
		currentCredits: int().default(0).notNull(),
		lastCreditRefreshAt: datetime(),
		// Athlete profile fields for competition platform
		gender: varchar({
			length: 50,
			enum: genderTuple,
		}).$type<Gender>(),
		dateOfBirth: datetime(),
		// Default affiliate/gym for competition registration
		affiliateName: varchar({
			length: 255,
		}),
		// JSON field for extended athlete profile (PRs, history, etc.)
		athleteProfile: varchar({
			length: 10000,
		}),
	},
	(table) => [
		index("email_idx").on(table.email),
		index("google_account_id_idx").on(table.googleAccountId),
		index("role_idx").on(table.role),
		index("user_gender_idx").on(table.gender),
		index("user_dob_idx").on(table.dateOfBirth),
	],
)

// Passkey credentials table
export const passKeyCredentialTable = mysqlTable(
	"passkey_credentials",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createPasskeyId())
			.notNull(),
		userId: varchar({ length: 255 })
			.notNull(),
		credentialId: varchar({
			length: 255,
		})
			.notNull()
			.unique(),
		credentialPublicKey: varchar({
			length: 255,
		}).notNull(),
		counter: int().notNull(),
		// Optional array of AuthenticatorTransport as JSON string
		transports: varchar({
			length: 255,
		}),
		// Authenticator Attestation GUID. We use this to identify the device/authenticator app that created the passkey
		aaguid: varchar({
			length: 255,
		}),
		// The user agent of the device that created the passkey
		userAgent: varchar({
			length: 255,
		}),
		// The IP address that created the passkey
		ipAddress: varchar({
			length: 128,
		}),
	},
	(table) => [
		index("user_id_idx").on(table.userId),
		index("credential_id_idx").on(table.credentialId),
	],
)

// User relations
export const userRelations = relations(userTable, ({ many }) => ({
	passkeys: many(passKeyCredentialTable),
	// Competition platform relations - two separate relations for user and captain
	competitionRegistrations: many(competitionRegistrationsTable, {
		relationName: "registeredUser",
	}),
	captainedRegistrations: many(competitionRegistrationsTable, {
		relationName: "captainUser",
	}),
}))

export const passKeyCredentialRelations = relations(
	passKeyCredentialTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [passKeyCredentialTable.userId],
			references: [userTable.id],
		}),
	}),
)

// Type exports
export type User = InferSelectModel<typeof userTable>
export type PassKeyCredential = InferSelectModel<typeof passKeyCredentialTable>
