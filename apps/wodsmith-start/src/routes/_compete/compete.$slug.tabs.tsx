import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Suspense } from "react"
import { CompetitionTabs } from "~/components/compete/competition-tabs"
import { getCompetitionFn } from "~/server-functions/competitions"
import { notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/_compete/compete/$slug/tabs")({
	loader: async ({ params }) => {
		const compResult = await getCompetitionFn({
			data: { idOrSlug: params.slug },
		})

		if (!compResult.success || !compResult.data) {
			throw notFound()
		}

		return { competition: compResult.data }
	},
	component: CompetitionTabsLayoutComponent,
})

function CompetitionTabsLayoutComponent() {
	const { competition } = Route.useLoaderData()

	return (
		<div className="space-y-4">
			<CompetitionTabs competitionId={competition.id} />
			<Outlet />
		</div>
	)
}
