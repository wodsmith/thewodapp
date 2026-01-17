/**
 * Competition Registration Route
 * Port from apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/register/page.tsx
 *
 * This file uses top-level imports for server-only modules.
 */

import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import {
	competitionRegistrationsTable,
	scalingGroupsTable,
	userTable,
} from "@/db/schema"
import { RegistrationForm } from "@/components/registration/registration-form"
import {
	getPublicCompetitionDivisionsFn,
	parseCompetitionSettings,
} from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getCompetitionQuestionsFn } from "@/server-fns/registration-questions-fns"
import { cancelPendingPurchaseFn } from "@/server-fns/registration-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import { getLocalDateKey } from "@/utils/date-utils"

// Search params validation
const registerSearchSchema = z.object({
	canceled: z.enum(["true", "false"]).optional().catch(undefined),
})

// Server function to check if user is already registered
const getUserCompetitionRegistrationFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: z.string(),
				userId: z.string(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const { getDb } = await import("@/db")
		const db = getDb()
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: and(
					eq(competitionRegistrationsTable.eventId, data.competitionId),
					eq(competitionRegistrationsTable.userId, data.userId),
				),
			},
		)

		return {
			isRegistered: !!registration,
			registration: registration || null,
		}
	})

// Server function to get scaling group with levels (avoids client-side db import)
const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ scalingGroupId: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const { getDb } = await import("@/db")
		const db = getDb()
		const scalingGroup = await db.query.scalingGroupsTable.findFirst({
			where: eq(scalingGroupsTable.id, data.scalingGroupId),
			with: {
				scalingLevels: {
					orderBy: (table, { asc }) => [asc(table.position)],
				},
			},
		})

		return { scalingGroup }
	})

// Server function to get user's affiliate name
const getUserAffiliateNameFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ userId: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const { getDb } = await import("@/db")
		const db = getDb()
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, data.userId),
			columns: { affiliateName: true },
		})

		return { affiliateName: user?.affiliateName ?? null }
	})

export const Route = createFileRoute("/compete/$slug/register")({
	component: RegisterPage,
	validateSearch: registerSearchSchema,
	staleTime: 10_000, // Cache for 10 seconds
	loaderDeps: ({ search }) => ({ canceled: search.canceled }),
	loader: async ({ params, context, deps }) => {
		const { slug } = params
		const { canceled } = deps

		// 1. Get competition first (needed for redirects and other fetches)
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })
		if (!competition) {
			throw notFound()
		}

		// 2. Check authentication
		const session = context.session ?? null
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/register` },
			})
		}

		// 2.5. If user canceled from Stripe, release their reservation immediately
		if (canceled === "true") {
			await cancelPendingPurchaseFn({
				data: {
					userId: session.userId,
					competitionId: competition.id,
				},
			})
		}

		// 3. Parallel fetch: registration check, affiliate name, waivers, and questions
		// These all only need competition.id or session.userId
		const [
			{ registration: existingRegistration },
			{ affiliateName },
			{ waivers },
			{ questions },
		] = await Promise.all([
			getUserCompetitionRegistrationFn({
				data: {
					competitionId: competition.id,
					userId: session.userId,
				},
			}),
			getUserAffiliateNameFn({
				data: { userId: session.userId },
			}),
			getCompetitionWaiversFn({
				data: { competitionId: competition.id },
			}),
			getCompetitionQuestionsFn({
				data: { competitionId: competition.id },
			}),
		])

		if (existingRegistration) {
			throw redirect({ to: "/compete/$slug", params: { slug } })
		}

		// 4. Check registration window (dates are now YYYY-MM-DD strings)
		const now = new Date()
		const todayStr = getLocalDateKey(now)
		const regOpensAt = competition.registrationOpensAt
		const regClosesAt = competition.registrationClosesAt

		// String comparison works for YYYY-MM-DD format
		const registrationOpen = !!(
			regOpensAt &&
			regClosesAt &&
			todayStr >= regOpensAt &&
			todayStr <= regClosesAt
		)

		// 5. Get competition settings for divisions
		const settings = parseCompetitionSettings(competition.settings)
		if (!settings?.divisions?.scalingGroupId) {
			// No divisions configured - will show error in component
			return {
				competition,
				scalingGroup: null,
				publicDivisions: [],
				userId: session.userId,
				registrationOpen,
				registrationOpensAt: regOpensAt,
				registrationClosesAt: regClosesAt,
				defaultAffiliateName: undefined,
				divisionsConfigured: false,
				waivers: [],
				questions: [],
			}
		}

		// 6. Get scaling group and levels for divisions (via server function)
		// Also get public divisions for capacity info
		const [{ scalingGroup }, { divisions: publicDivisions }] = await Promise.all(
			[
				getScalingGroupWithLevelsFn({
					data: { scalingGroupId: settings.divisions.scalingGroupId },
				}),
				getPublicCompetitionDivisionsFn({
					data: { competitionId: competition.id },
				}),
			],
		)

		if (
			!scalingGroup ||
			!scalingGroup.scalingLevels ||
			scalingGroup.scalingLevels.length === 0
		) {
			// Divisions not properly configured - will show error in component
			return {
				competition,
				scalingGroup: null,
				publicDivisions: [],
				userId: session.userId,
				registrationOpen,
				registrationOpensAt: regOpensAt,
				registrationClosesAt: regClosesAt,
				defaultAffiliateName: undefined,
				divisionsConfigured: false,
				waivers: [],
				questions: [],
			}
		}

		return {
			competition,
			scalingGroup,
			publicDivisions,
			userId: session.userId,
			registrationOpen,
			registrationOpensAt: regOpensAt,
			registrationClosesAt: regClosesAt,
			defaultAffiliateName: affiliateName ?? undefined,
			divisionsConfigured: true,
			waivers,
			questions,
		}
	},
})

function RegisterPage() {
	const {
		competition,
		scalingGroup,
		publicDivisions,
		userId,
		registrationOpen,
		registrationOpensAt,
		registrationClosesAt,
		defaultAffiliateName,
		divisionsConfigured,
		waivers,
		questions,
	} = Route.useLoaderData()

	const { canceled } = Route.useSearch()

	// Show error if divisions are not configured
	if (!divisionsConfigured || !scalingGroup) {
		return (
			<div className="mx-auto max-w-2xl">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">
						Registration Not Available
					</h1>
					<p>
						{!divisionsConfigured
							? "This competition does not have divisions configured yet."
							: "This competition's divisions are not properly configured."}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-2xl">
			<RegistrationForm
				competition={competition}
				scalingGroup={scalingGroup}
				publicDivisions={publicDivisions}
				userId={userId}
				registrationOpen={registrationOpen}
				registrationOpensAt={registrationOpensAt}
				registrationClosesAt={registrationClosesAt}
				paymentCanceled={canceled === "true"}
				defaultAffiliateName={defaultAffiliateName}
				waivers={waivers}
				questions={questions}
			/>
		</div>
	)
}
