/**
 * Competition Registration Route
 * Port from apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/register/page.tsx
 */

import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { RegistrationForm } from "@/components/registration/registration-form"
import { parseCompetitionSettings } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"

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
		const { competitionRegistrationsTable } = await import("@/db/schema")
		const { and, eq } = await import("drizzle-orm")

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
		const { scalingGroupsTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

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
		const { userTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

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
	loader: async ({ params, context }) => {
		const { slug } = params

		// 1. Get competition first (needed for redirects)
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

		// 3. Check if already registered
		const { registration: existingRegistration } =
			await getUserCompetitionRegistrationFn({
				data: {
					competitionId: competition.id,
					userId: session.userId,
				},
			})

		if (existingRegistration) {
			throw redirect({ to: "/compete/$slug", params: { slug } })
		}

		// 4. Check profile completeness (commented out in original)
		// if (!session.user.gender || !session.user.dateOfBirth) {
		//   throw redirect({
		//     to: '/compete/profile',
		//     search: {redirect: `/compete/${slug}/register`},
		//   })
		// }

		// 5. Check registration window
		const now = new Date()
		const regOpensAt = competition.registrationOpensAt
			? typeof competition.registrationOpensAt === "number"
				? new Date(competition.registrationOpensAt)
				: competition.registrationOpensAt
			: null
		const regClosesAt = competition.registrationClosesAt
			? typeof competition.registrationClosesAt === "number"
				? new Date(competition.registrationClosesAt)
				: competition.registrationClosesAt
			: null

		const registrationOpen = !!(
			regOpensAt &&
			regClosesAt &&
			regOpensAt <= now &&
			regClosesAt >= now
		)

		// 6. Get competition settings for divisions
		const settings = parseCompetitionSettings(competition.settings)
		if (!settings?.divisions?.scalingGroupId) {
			// No divisions configured - will show error in component
			return {
				competition,
				scalingGroup: null,
				userId: session.userId,
				registrationOpen,
				registrationOpensAt: regOpensAt,
				registrationClosesAt: regClosesAt,
				defaultAffiliateName: undefined,
				divisionsConfigured: false,
				waivers: [],
			}
		}

		// 7. Get scaling group and levels for divisions (via server function)
		const { scalingGroup } = await getScalingGroupWithLevelsFn({
			data: { scalingGroupId: settings.divisions.scalingGroupId },
		})

		if (
			!scalingGroup ||
			!scalingGroup.scalingLevels ||
			scalingGroup.scalingLevels.length === 0
		) {
			// Divisions not properly configured - will show error in component
			return {
				competition,
				scalingGroup: null,
				userId: session.userId,
				registrationOpen,
				registrationOpensAt: regOpensAt,
				registrationClosesAt: regClosesAt,
				defaultAffiliateName: undefined,
				divisionsConfigured: false,
				waivers: [],
			}
		}

		// 8. Fetch user's affiliate from their profile (via server function)
		const { affiliateName } = await getUserAffiliateNameFn({
			data: { userId: session.userId },
		})

		// 9. Fetch waivers for this competition
		const { waivers } = await getCompetitionWaiversFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			scalingGroup,
			userId: session.userId,
			registrationOpen,
			registrationOpensAt: regOpensAt,
			registrationClosesAt: regClosesAt,
			defaultAffiliateName: affiliateName ?? undefined,
			divisionsConfigured: true,
			waivers,
		}
	},
})

function RegisterPage() {
	const {
		competition,
		scalingGroup,
		userId,
		registrationOpen,
		registrationOpensAt,
		registrationClosesAt,
		defaultAffiliateName,
		divisionsConfigured,
		waivers,
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
				userId={userId}
				registrationOpen={registrationOpen}
				registrationOpensAt={registrationOpensAt}
				registrationClosesAt={registrationClosesAt}
				paymentCanceled={canceled === "true"}
				defaultAffiliateName={defaultAffiliateName}
				waivers={waivers}
			/>
		</div>
	)
}
