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

		const athleteName = `${session.user.firstName} ${session.user.lastName}`
		const affiliateName = affiliateResult.affiliateName ?? "Independent"

		const items = registrations.map((reg) => {
			const div = reg.divisionId
				? divisions.find((d) => d.id === reg.divisionId)
				: null
			return {
				registrationId: reg.id,
				divisionLabel: div?.label ?? null,
				teamName: reg.teamName,
			}
		})

		return { athleteName, affiliateName, items }
	},
})

function RegisteredPage() {
	const { competition } = parentRoute.useLoaderData()
	const { athleteName, affiliateName, items } = Route.useLoaderData()
	const { slug } = Route.useParams()

	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="space-y-4">
			{/* Sticky Tabs */}
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>

			{/* Mobile: share card */}
			<div className="flex flex-col items-center gap-6 md:hidden">
				<CompetitionShareCard
					competitionName={competition.name}
					athleteName={athleteName}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
					items={items}
				/>
				{items.map((item) => (
					<Button
						key={item.registrationId}
						variant="ghost"
						size="sm"
						asChild
						className="text-slate-400"
					>
						<Link
							to="/compete/$slug/teams/$registrationId"
							params={{ slug, registrationId: item.registrationId }}
						>
							View {item.divisionLabel ?? "Registration"}
						</Link>
					</Button>
				))}
			</div>

			{/* Desktop: banner */}
			<div className="hidden flex-col items-center gap-6 md:flex">
				<CompetitionRegisteredBanner
					competitionName={competition.name}
					athleteName={athleteName}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
					items={items}
				/>
				{items.map((item) => (
					<Button
						key={item.registrationId}
						variant="ghost"
						size="sm"
						asChild
						className="text-slate-400"
					>
						<Link
							to="/compete/$slug/teams/$registrationId"
							params={{ slug, registrationId: item.registrationId }}
						>
							View {item.divisionLabel ?? "Registration"}
						</Link>
					</Button>
				))}
			</div>
		</div>
	)
}
