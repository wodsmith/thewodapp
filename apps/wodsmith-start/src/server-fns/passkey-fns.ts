/**
 * Passkey Management Server Functions for TanStack Start
 * Handles listing and deleting user passkeys
 */
import "server-only"

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { UAParser } from "ua-parser-js"
import { z } from "zod"
import { getDb } from "@/db"
import { passKeyCredentialTable, userTable } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedUserAgent {
	ua: string
	browser: {
		name: string | undefined
		version: string | undefined
		major: string | undefined
	}
	device: {
		model: string | undefined
		type: string | undefined
		vendor: string | undefined
	}
	engine: {
		name: string | undefined
		version: string | undefined
	}
	os: {
		name: string | undefined
		version: string | undefined
	}
}

export interface PasskeyWithMeta {
	id: string
	credentialId: string
	userId: string
	createdAt: Date
	aaguid: string | null
	userAgent: string | null
	parsedUserAgent: ParsedUserAgent
}

// ============================================================================
// Input Schemas
// ============================================================================

const deletePasskeyInputSchema = z.object({
	credentialId: z.string().min(1, "Credential ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all passkeys for the current user
 */
export const getUserPasskeysFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromCookie()

		if (!session?.user?.id) {
			throw new Error("Not authenticated")
		}

		if (!session.user.emailVerified) {
			throw new Error("Email not verified")
		}

		const db = getDb()
		const passkeys = await db
			.select()
			.from(passKeyCredentialTable)
			.where(eq(passKeyCredentialTable.userId, session.user.id))

		// Parse user agent for each passkey
		const passkeysWithParsedUA: PasskeyWithMeta[] = passkeys.map((passkey) => {
			const userAgent = passkey.userAgent ?? null
			const result = new UAParser(userAgent ?? "").getResult()

			return {
				id: passkey.id,
				credentialId: passkey.credentialId,
				userId: passkey.userId,
				createdAt: passkey.createdAt,
				aaguid: passkey.aaguid ?? null,
				userAgent: userAgent,
				parsedUserAgent: {
					ua: userAgent ?? "",
					browser: {
						name: result.browser.name,
						version: result.browser.version,
						major: result.browser.major,
					},
					device: {
						model: result.device.model,
						type: result.device.type,
						vendor: result.device.vendor,
					},
					engine: {
						name: result.engine.name,
						version: result.engine.version,
					},
					os: {
						name: result.os.name,
						version: result.os.version,
					},
				},
			}
		})

		return {
			passkeys: passkeysWithParsedUA,
			currentPasskeyId: session.passkeyCredentialId ?? null,
			email: session.user.email,
		}
	},
)

/**
 * Delete a passkey
 */
export const deletePasskeyFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deletePasskeyInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()

		if (!session?.user?.id) {
			throw new Error("Not authenticated")
		}

		if (!session.user.emailVerified) {
			throw new Error("Email not verified")
		}

		// Prevent deletion of the current passkey
		if (session.passkeyCredentialId === data.credentialId) {
			throw new Error("Cannot delete the current passkey")
		}

		const db = getDb()

		// Get all user's passkeys
		const passkeys = await db
			.select()
			.from(passKeyCredentialTable)
			.where(eq(passKeyCredentialTable.userId, session.user.id))

		// Get full user data to check if they have a password
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.user.id),
		})

		// Check if this is the last passkey and if the user has a password
		if (passkeys.length === 1 && !user?.passwordHash) {
			throw new Error("Cannot delete the last passkey when no password is set")
		}

		// Delete the passkey
		await db
			.delete(passKeyCredentialTable)
			.where(eq(passKeyCredentialTable.credentialId, data.credentialId))

		return { success: true }
	})
