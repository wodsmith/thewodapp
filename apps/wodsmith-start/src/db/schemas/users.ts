import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
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
export const userTable = sqliteTable(
	"user",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createUserId())
			.notNull(),
		firstName: text({
			length: 255,
		}),
		lastName: text({
			length: 255,
		}),
		email: text({
			length: 255,
		}).unique(),
		passwordHash: text(),
		role: text({
			enum: roleTuple,
		})
			.default(ROLES_ENUM.USER)
			.notNull(),
		emailVerified: integer({
			mode: "timestamp",
		}),
		signUpIpAddress: text({
			length: 128,
		}),
		googleAccountId: text({
			length: 255,
		}),
		/**
		 * This can either be an absolute or relative path to an image
		 */
		avatar: text({
			length: 600,
		}),
		// Credit system fields
		currentCredits: integer().default(0).notNull(),
		lastCreditRefreshAt: integer({
			mode: "timestamp",
		}),
		// Athlete profile fields for competition platform
		gender: text({
			enum: genderTuple,
		}).$type<Gender>(),
		dateOfBirth: integer({
			mode: "timestamp",
		}),
		// Default affiliate/gym for competition registration
		affiliateName: text({
			length: 255,
		}),
		// JSON field for extended athlete profile (PRs, history, etc.)
		athleteProfile: text({
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
export const passKeyCredentialTable = sqliteTable(
	"passkey_credential",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createPasskeyId())
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		credentialId: text({
			length: 255,
		})
			.notNull()
			.unique(),
		credentialPublicKey: text({
			length: 255,
		}).notNull(),
		counter: integer().notNull(),
		// Optional array of AuthenticatorTransport as JSON string
		transports: text({
			length: 255,
		}),
		// Authenticator Attestation GUID. We use this to identify the device/authenticator app that created the passkey
		aaguid: text({
			length: 255,
		}),
		// The user agent of the device that created the passkey
		userAgent: text({
			length: 255,
		}),
		// The IP address that created the passkey
		ipAddress: text({
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
