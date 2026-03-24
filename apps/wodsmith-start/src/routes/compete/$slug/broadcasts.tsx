/**
 * Athlete Broadcasts Route
 *
 * Shows broadcasts the athlete has received for a competition.
 */
// @lat: [[organizer-dashboard#Broadcasts]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { Megaphone } from "lucide-react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { listAthleteBroadcastsFn } from "@/server-fns/broadcast-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/broadcasts")({
	staleTime: 10_000,
	component: AthleteBroadcastsPage,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		const { broadcasts } = await listAthleteBroadcastsFn({
			data: { competitionId: competition.id },
		})

		return { broadcasts }
	},
})

function AthleteBroadcastsPage() {
	const { broadcasts } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()

	return (
		<div className="space-y-6">
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>

			<div>
				<h2 className="text-xl font-bold tracking-tight mb-1">
					Broadcasts
				</h2>
				<p className="text-muted-foreground text-sm">
					Announcements from the organizer
				</p>
			</div>

			{broadcasts.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-1">
							No broadcasts yet
						</h3>
						<p className="text-muted-foreground text-sm">
							The organizer hasn&apos;t sent any broadcasts for this
							competition
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{broadcasts.map((broadcast) => (
						<Card key={broadcast.id}>
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">
									{broadcast.title}
								</CardTitle>
								<CardDescription>
									{broadcast.sentAt
										? new Date(broadcast.sentAt).toLocaleDateString(
												"en-US",
												{
													month: "short",
													day: "numeric",
													year: "numeric",
													hour: "numeric",
													minute: "2-digit",
												},
											)
										: ""}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm whitespace-pre-wrap">
									{broadcast.body}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
