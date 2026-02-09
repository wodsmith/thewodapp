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
import { getUserCompetitionRegistrationFn } from "@/server-fns/competition-detail-fns"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getUserAffiliateNameFn } from "@/server-fns/registration-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/registered")({
	component: RegisteredPage,
	validateSearch: z.object({
		session_id: z.string().optional(),
		registration_id: z.string().optional(),
	}),
	loader: async ({ params, context }) => {
		const { slug } = params
		const session = context?.session ?? null

		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}` },
			})
		}

		const { competition } = await getCompetitionBySlugFn({ data: { slug } })
		if (!competition) {
			throw redirect({ to: "/compete" })
		}

		const [{ registration }, { divisions }, affiliateResult] =
			await Promise.all([
				getUserCompetitionRegistrationFn({
					data: {
						competitionId: competition.id,
						userId: session.userId,
					},
				}),
				getPublicCompetitionDivisionsFn({
					data: { competitionId: competition.id },
				}),
				getUserAffiliateNameFn({
					data: { userId: session.userId },
				}),
			])

		if (!registration) {
			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

		const userDivision = registration.divisionId
			? divisions.find((d) => d.id === registration.divisionId)
			: null

		return {
			athleteName: `${session.user.firstName} ${session.user.lastName}`,
			divisionLabel: userDivision?.label ?? null,
			affiliateName: affiliateResult.affiliateName ?? "Independent",
			registrationId: registration.id,
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
