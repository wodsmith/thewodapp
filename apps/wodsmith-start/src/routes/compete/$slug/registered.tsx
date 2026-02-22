import {
	createFileRoute,
	getRouteApi,
	Link,
	redirect,
} from "@tanstack/react-router"
import { z } from "zod"
import { CompetitionRegisteredBanner } from "@/components/competition-registered-banner"
import { CompetitionShareCard } from "@/components/competition-share-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { Button } from "@/components/ui/button"
import { getUserCompetitionRegistrationsFn } from "@/server-fns/competition-detail-fns"
import { getUserAffiliateNameFn } from "@/server-fns/registration-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/registered")({
	component: RegisteredPage,
	validateSearch: z.object({
		session_id: z.string().optional(),
		registration_id: z.string().optional(),
	}),
	loader: async ({ params, context, parentMatchPromise }) => {
		const { slug } = params
		const session = context?.session ?? null

		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}` },
			})
		}

		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition
		const divisions = parentMatch.loaderData?.divisions ?? []
		if (!competition) {
			throw redirect({ to: "/compete" })
		}

		const [{ registrations }, affiliateResult] =
			await Promise.all([
				getUserCompetitionRegistrationsFn({
					data: {
						competitionId: competition.id,
						userId: session.userId,
					},
				}),
				getUserAffiliateNameFn({
					data: { userId: session.userId },
				}),
			])

		if (registrations.length === 0) {
			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

		// Show the most recent registration (last in list)
		const latestRegistration = registrations[registrations.length - 1]

		const userDivision = latestRegistration.divisionId
			? divisions.find((d) => d.id === latestRegistration.divisionId)
			: null

		// Build division labels for multi-registration display
		const allDivisionLabels = registrations.map((reg) => {
			const div = reg.divisionId
				? divisions.find((d) => d.id === reg.divisionId)
				: null
			return div?.label ?? "Division"
		})

		return {
			athleteName: `${session.user.firstName} ${session.user.lastName}`,
			divisionLabel:
				registrations.length > 1
					? allDivisionLabels.join(", ")
					: (userDivision?.label ?? null),
			affiliateName: affiliateResult.affiliateName ?? "Independent",
			registrationId: latestRegistration.id,
		}
	},
})

function RegisteredPage() {
	const { competition } = parentRoute.useLoaderData()
	const { athleteName, divisionLabel, affiliateName, registrationId } =
		Route.useLoaderData()
	const { slug } = Route.useParams()

	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="space-y-4">
			{/* Sticky Tabs */}
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>

			{/* Mobile: share card as full body content */}
			<div className="flex flex-col items-center gap-6 md:hidden">
				<CompetitionShareCard
					competitionName={competition.name}
					athleteName={athleteName}
					division={divisionLabel ?? undefined}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
				/>
				<Button variant="ghost" size="sm" asChild className="text-slate-400">
					<Link
						to="/compete/$slug/teams/$registrationId"
						params={{ slug, registrationId }}
					>
						View Registration
					</Link>
				</Button>
			</div>

			{/* Desktop: banner with everything built in */}
			<div className="hidden flex-col items-center gap-6 md:flex">
				<CompetitionRegisteredBanner
					competitionName={competition.name}
					athleteName={athleteName}
					division={divisionLabel ?? undefined}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
				/>
				<Button variant="ghost" size="sm" asChild className="text-slate-400">
					<Link
						to="/compete/$slug/teams/$registrationId"
						params={{ slug, registrationId }}
					>
						View Registration
					</Link>
				</Button>
			</div>
		</div>
	)
}
