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
	"user",
	{
		...commonColumns,
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => createUserId())
			.notNull(),
		firstName: varchar("first_name", {
			length: 255,
		}),
		lastName: varchar("last_name", {
			length: 255,
		}),
		email: varchar("email", {
			length: 255,
		}).unique(),
		passwordHash: varchar("password_hash", { length: 255 }),
		role: varchar("role", {
			length: 50,
			enum: roleTuple,
		})
			.default(ROLES_ENUM.USER)
			.notNull(),
		emailVerified: datetime("email_verified"),
		signUpIpAddress: varchar("sign_up_ip_address", {
			length: 128,
		}),
		googleAccountId: varchar("google_account_id", {
			length: 255,
		}),
		/**
		 * This can either be an absolute or relative path to an image
		 */
		avatar: varchar("avatar", {
			length: 600,
		}),
		// Credit system fields
		currentCredits: int("current_credits").default(0).notNull(),
		lastCreditRefreshAt: datetime("last_credit_refresh_at"),
		// Athlete profile fields for competition platform
		gender: varchar("gender", {
			length: 50,
			enum: genderTuple,
		}).$type<Gender>(),
		dateOfBirth: datetime("date_of_birth"),
		// Default affiliate/gym for competition registration
		affiliateName: varchar("affiliate_name", {
			length: 255,
		}),
		// JSON field for extended athlete profile (PRs, history, etc.)
		athleteProfile: varchar("athlete_profile", {
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
	"passkey_credential",
	{
		...commonColumns,
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => createPasskeyId())
			.notNull(),
		userId: varchar("user_id", { length: 255 })
			.notNull(),
		credentialId: varchar("credential_id", {
			length: 255,
		})
			.notNull()
			.unique(),
		credentialPublicKey: varchar("credential_public_key", {
			length: 255,
		}).notNull(),
		counter: int("counter").notNull(),
		// Optional array of AuthenticatorTransport as JSON string
		transports: varchar("transports", {
			length: 255,
		}),
		// Authenticator Attestation GUID. We use this to identify the device/authenticator app that created the passkey
		aaguid: varchar("aaguid", {
			length: 255,
		}),
		// The user agent of the device that created the passkey
		userAgent: varchar("user_agent", {
			length: 255,
		}),
		// The IP address that created the passkey
		ipAddress: varchar("ip_address", {
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
