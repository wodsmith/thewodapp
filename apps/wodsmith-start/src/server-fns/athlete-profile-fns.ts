/**
 * Athlete Profile Server Functions for TanStack Start
 * Functions for getting and updating athlete-specific profile data
 */

import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { GENDER_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

export const athleteProfileExtendedSchema = z.object({
	// Core profile fields (stored as direct columns)
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE]).optional(),
	dateOfBirth: z.string().optional(), // ISO date string YYYY-MM-DD
	affiliateName: z.string().max(255).optional(), // Default affiliate for registration

	// Extended profile fields (stored as JSON)
	preferredUnits: z.enum(["imperial", "metric"]).optional(),
	heightCm: z.number().positive().optional(),
	weightKg: z.number().positive().optional(),
	coverImageUrl: z.string().optional(),

	conditioning: z
		.object({
			fran: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			grace: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			helen: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			diane: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			murph: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			row2k: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			run1Mile: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			run5k: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			row500m: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			maxPullups: z
				.object({ reps: z.string().optional(), date: z.string().optional() })
				.optional(),
			maxCindyRounds: z
				.object({ rounds: z.string().optional(), date: z.string().optional() })
				.optional(),
		})
		.optional(),

	strength: z
		.object({
			backSquat: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			deadlift: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			benchPress: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			press: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			snatch: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			cleanAndJerk: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
		})
		.optional(),

	social: z
		.object({
			facebook: z.string().url().optional().or(z.literal("")),
			instagram: z.string().url().optional().or(z.literal("")),
			twitter: z.string().url().optional().or(z.literal("")),
			tiktok: z.string().url().optional().or(z.literal("")),
		})
		.optional(),
})

export type AthleteProfileFormValues = z.infer<
	typeof athleteProfileExtendedSchema
>

export const updateAthleteBasicProfileSchema = z.object({
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE]),
	dateOfBirth: z.date(),
	affiliateName: z.string().min(1).max(255),
})

export type UpdateAthleteBasicProfileInput = z.infer<
	typeof updateAthleteBasicProfileSchema
>

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get athlete edit page data
 */
export const getAthleteEditDataFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: "/compete/athlete/edit" },
			})
		}

		const { eq } = await import("drizzle-orm")
		const { getDb } = await import("@/db")
		const { userTable } = await import("@/db/schema")

		const db = getDb()

		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.userId),
			columns: {
				athleteProfile: true,
				gender: true,
				dateOfBirth: true,
				affiliateName: true,
			},
		})

		if (!user) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: "/compete/athlete/edit" },
			})
		}

		return { user }
	},
)

/**
 * Update athlete extended profile (full profile with benchmarks, social, etc.)
 */
export const updateAthleteExtendedProfileFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => athleteProfileExtendedSchema.parse(data))
	.handler(async ({ data: input }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		const { eq } = await import("drizzle-orm")
		const { getDb } = await import("@/db")
		const { userTable } = await import("@/db/schema")
		const { updateAllSessionsOfUser } = await import("@/utils/kv-session")

		const db = getDb()

		// Extract direct column fields
		const { gender, dateOfBirth, affiliateName, ...jsonFields } = input

		// Stringify the athleteProfile JSON (excluding direct column fields)
		const athleteProfileJson = JSON.stringify(jsonFields)

		// Build update object
		const updateData: {
			athleteProfile: string
			gender?: "male" | "female"
			dateOfBirth?: Date
			affiliateName?: string | null
		} = {
			athleteProfile: athleteProfileJson,
		}

		// Add direct column fields if provided
		if (gender) {
			updateData.gender = gender
		}
		if (dateOfBirth) {
			updateData.dateOfBirth = new Date(dateOfBirth)
		}
		// affiliateName can be set to empty string to clear, or a value to set
		if (affiliateName !== undefined) {
			updateData.affiliateName = affiliateName || null
		}

		await db
			.update(userTable)
			.set(updateData)
			.where(eq(userTable.id, session.userId))

		await updateAllSessionsOfUser(session.userId)

		return { success: true }
	})

/**
 * Update athlete basic profile (gender, dateOfBirth, affiliateName only)
 * Used on registration success page
 */
export const updateAthleteBasicProfileFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateAthleteBasicProfileSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		const { getDb } = await import("@/db")
		const { userTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

		const db = getDb()

		await db
			.update(userTable)
			.set({
				gender: data.gender,
				dateOfBirth: data.dateOfBirth,
				affiliateName: data.affiliateName,
			})
			.where(eq(userTable.id, session.userId))

		return { success: true }
	})

/**
 * Get athlete profile page data (full profile with competition history)
 */
export const getAthleteProfileDataFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const session = await getSessionFromCookie()
	if (!session) {
		throw redirect({
			to: "/sign-in",
			search: { redirect: "/compete/athlete" },
		})
	}

	// Dynamic imports to avoid cloudflare:workers resolution in client bundle
	const { eq, and, inArray } = await import("drizzle-orm")
	const { getDb } = await import("@/db")
	const { userTable, competitionRegistrationsTable, teamMembershipTable } =
		await import("@/db/schema")
	const { getUserSponsorsFn } = await import("@/server-fns/sponsor-fns")
	const { autochunk } = await import("@/utils/batch-query")

	const db = getDb()

	// Fetch user profile data
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
		columns: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			avatar: true,
			gender: true,
			dateOfBirth: true,
			athleteProfile: true,
			affiliateName: true,
		},
	})

	if (!user) {
		throw redirect({
			to: "/sign-in",
			search: { redirect: "/compete/athlete" },
		})
	}

	// Get sponsors
	const sponsorsResult = await getUserSponsorsFn({
		data: { userId: session.userId },
	})

	// Get direct registrations (user is captain)
	const directRegistrations =
		await db.query.competitionRegistrationsTable.findMany({
			where: eq(competitionRegistrationsTable.userId, session.userId),
			with: {
				competition: {
					with: {
						organizingTeam: true,
					},
				},
				division: true,
				athleteTeam: true,
			},
			orderBy: (table, { desc }) => [desc(table.registeredAt)],
		})

	// Get team registrations (user is teammate)
	const userTeamMemberships = await db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.userId, session.userId),
			eq(teamMembershipTable.isActive, 1),
		),
		columns: { teamId: true },
	})

	const userTeamIds = userTeamMemberships.map((m) => m.teamId)

	// Get team registrations (batched to avoid SQL variable limit)
	const teamRegistrations = await autochunk(
		{ items: userTeamIds },
		async (chunk: string[]) =>
			db.query.competitionRegistrationsTable.findMany({
				where: inArray(competitionRegistrationsTable.athleteTeamId, chunk),
				with: {
					competition: {
						with: {
							organizingTeam: true,
						},
					},
					division: true,
					athleteTeam: true,
				},
				orderBy: (table, { desc }) => [desc(table.registeredAt)],
			}),
	)

	// Combine and deduplicate by registration ID
	const allRegistrations = [...directRegistrations, ...teamRegistrations]
	const seenIds = new Set<string>()
	const competitionHistory = allRegistrations
		.filter((reg) => {
			if (seenIds.has(reg.id)) return false
			seenIds.add(reg.id)
			return true
		})
		.sort((a, b) => {
			const aDate = new Date(a.registeredAt).getTime()
			const bDate = new Date(b.registeredAt).getTime()
			return bDate - aDate
		})

	return {
		user,
		sponsors: sponsorsResult.sponsors,
		competitionHistory,
	}
})

/**
 * Get athlete invoices data
 */
export const getAthleteInvoicesDataFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const session = await getSessionFromCookie()
	if (!session) {
		throw redirect({
			to: "/sign-in",
			search: { redirect: "/compete/athlete/invoices" },
		})
	}

	const { getUserPurchases } = await import("@/server/commerce/purchases")
	const purchases = await getUserPurchases(session.userId)

	return { purchases }
})

const getInvoiceDetailsInputSchema = z.object({
	purchaseId: z.string(),
})

/**
 * Get invoice details for a specific purchase
 */
export const getInvoiceDetailsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getInvoiceDetailsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/athlete/invoices/${data.purchaseId}` },
			})
		}

		const { getInvoiceDetails } = await import("@/server/commerce/purchases")
		const invoice = await getInvoiceDetails(data.purchaseId, session.userId)

		return { invoice }
	})

// ============================================================================
// Registration Success Data
// ============================================================================

const getRegistrationSuccessDataInputSchema = z.object({
	competitionId: z.string(),
	userId: z.string(),
	sessionId: z.string().optional(),
	registrationId: z.string().optional(),
	commercePurchaseId: z.string().optional(),
	athleteTeamId: z.string().optional(),
	passStripeFeesToCustomer: z.boolean(),
})

/**
 * Get registration success page data
 */
export const getRegistrationSuccessDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getRegistrationSuccessDataInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Verify caller is authenticated and is the user they claim to be
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		// Ensure the caller can only access their own registration data
		if (session.userId !== data.userId) {
			throw new Error(
				"Unauthorized: Cannot access another user's registration data",
			)
		}

		const { getDb } = await import("@/db")
		const { userTable, commercePurchaseTable, teamInvitationTable } =
			await import("@/db/schema")
		const { eq } = await import("drizzle-orm")
		// Local stripe utility (no server-only import for TanStack Start compatibility)
		const { getStripe } = await import("@/lib/stripe")

		const db = getDb()

		// Get user profile to check if complete
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, data.userId),
		})

		const isProfileComplete =
			user?.gender && user?.dateOfBirth && user?.affiliateName

		// Fetch checkout session details if session_id provided
		let checkoutSession: Awaited<
			ReturnType<
				ReturnType<typeof getStripe>["checkout"]["sessions"]["retrieve"]
			>
		> | null = null

		if (data.sessionId) {
			try {
				checkoutSession = await getStripe().checkout.sessions.retrieve(
					data.sessionId,
					{
						expand: ["line_items", "payment_intent"],
					},
				)
			} catch {
				// Session not found or invalid - continue without payment details
			}
		}

		// Fetch purchase record for fee breakdown
		let purchase: typeof commercePurchaseTable.$inferSelect | null = null
		if (data.commercePurchaseId) {
			purchase =
				(await db.query.commercePurchaseTable.findFirst({
					where: eq(commercePurchaseTable.id, data.commercePurchaseId),
				})) ?? null
		}

		// Fetch team invitations if this is a team registration
		let teamInvites: Array<{
			id: string
			email: string
			token: string
			acceptedAt: Date | null
			expiresAt: Date
		}> = []

		if (data.athleteTeamId) {
			const invites = await db.query.teamInvitationTable.findMany({
				where: eq(teamInvitationTable.teamId, data.athleteTeamId),
			})
			teamInvites = invites.map((inv) => ({
				id: inv.id,
				email: inv.email,
				token: inv.token,
				acceptedAt: inv.acceptedAt,
				expiresAt: inv.expiresAt,
			}))
		}

		return {
			user,
			isProfileComplete,
			checkoutSession,
			purchase,
			teamInvites,
		}
	})
