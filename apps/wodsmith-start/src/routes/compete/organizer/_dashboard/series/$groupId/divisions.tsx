import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SeriesDivisionMapper } from "@/components/series-division-mapper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { usePostHog } from "@/lib/posthog"
import {
	getSeriesDivisionMappingsFn,
	setSeriesTemplateFn,
	type SeriesDivisionMappingData,
	type SeriesTemplateData,
} from "@/server-fns/series-division-mapping-fns"

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/series/$groupId/divisions",
)({
	component: SeriesDivisionsPage,
	loader: async ({ params }) => {
		const result = await getSeriesDivisionMappingsFn({
			data: { groupId: params.groupId },
		})
		return result
	},
})

function SeriesDivisionsPage() {
	const { groupId } = Route.useParams()
	const loaderData = Route.useLoaderData()
	const router = useRouter()
	const navigate = useNavigate()
	const { posthog } = usePostHog()

	const [template, setTemplate] = useState<SeriesTemplateData | null>(
		loaderData.template,
	)
	const [competitionMappings, setCompetitionMappings] = useState<
		SeriesDivisionMappingData[]
	>(loaderData.competitionMappings)
	const [selectedSourceGroup, setSelectedSourceGroup] = useState<string>("")
	const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

	const setTemplateFn = useServerFn(setSeriesTemplateFn)

	const [flagEnabled, setFlagEnabled] = useState(() =>
		posthog.isFeatureEnabled("competition-global-leaderboard"),
	)

	useEffect(() => {
		const unsubscribe = posthog.onFeatureFlags(() => {
			setFlagEnabled(
				posthog.isFeatureEnabled("competition-global-leaderboard"),
			)
		})
		return unsubscribe
	}, [posthog])

	useEffect(() => {
		if (flagEnabled === false) {
			navigate({
				to: "/compete/organizer/series/$groupId",
				replace: true,
				params: { groupId },
			})
		}
	}, [flagEnabled, groupId, navigate])

	if (flagEnabled === false) return null

	const handleCreateFromExisting = async () => {
		if (!selectedSourceGroup) return
		setIsCreatingTemplate(true)
		try {
			await setTemplateFn({
				data: {
					groupId,
					sourceScalingGroupId: selectedSourceGroup,
				},
			})
			toast.success("Series template created")
			await router.invalidate()
			// Reload the data
			const refreshed = await getSeriesDivisionMappingsFn({
				data: { groupId },
			})
			setTemplate(refreshed.template)
			setCompetitionMappings(refreshed.competitionMappings)
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Failed to create template",
			)
		} finally {
			setIsCreatingTemplate(false)
		}
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<div className="mb-4">
						<Button variant="ghost" size="sm" asChild>
							<Link
								to="/compete/organizer/series/$groupId"
								params={{ groupId }}
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Series
							</Link>
						</Button>
					</div>
					<h1 className="text-3xl font-bold">
						Configure Leaderboard Divisions
					</h1>
					<p className="text-muted-foreground mt-1">
						Define the series division template and map each
						competition's divisions to it.
					</p>
				</div>

				{/* Step 1: Define or pick template */}
				{!template ? (
					<Card>
						<CardHeader>
							<CardTitle>
								Step 1: Define Series Divisions
							</CardTitle>
							<CardDescription>
								Choose a competition's divisions as a starting
								template for the series leaderboard.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-3">
								<Select
									value={selectedSourceGroup || "__none__"}
									onValueChange={(val) =>
										setSelectedSourceGroup(
											val === "__none__" ? "" : val,
										)
									}
								>
									<SelectTrigger className="w-[350px]">
										<SelectValue placeholder="Select a division template..." />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none__" disabled>
											Select a division template...
										</SelectItem>
										{loaderData.availableScalingGroups.map(
											(g) => (
												<SelectItem
													key={g.id}
													value={g.id}
												>
													{g.title}
													{g.levels.length > 0 && (
														<span className="ml-1 text-muted-foreground text-xs">
															(
															{g.levels
																.map(
																	(l) =>
																		l.label,
																)
																.join(", ")}
															)
														</span>
													)}
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
								<Button
									onClick={handleCreateFromExisting}
									disabled={
										!selectedSourceGroup ||
										isCreatingTemplate
									}
								>
									<Plus className="h-4 w-4 mr-2" />
									{isCreatingTemplate
										? "Creating..."
										: "Create Template"}
								</Button>
							</div>
						</CardContent>
					</Card>
				) : (
					<>
						{/* Template info card */}
						<Card>
							<CardHeader>
								<CardTitle>Series Template</CardTitle>
								<CardDescription>
									{template.scalingGroupTitle} —{" "}
									{template.divisions.length} divisions
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{template.divisions.map((d) => (
										<span
											key={d.id}
											className="inline-flex items-center rounded-full border px-3 py-1 text-sm"
										>
											{d.label}
											{d.teamSize > 1 && (
												<span className="ml-1 text-xs text-muted-foreground">
													(team of {d.teamSize})
												</span>
											)}
										</span>
									))}
								</div>
								<div className="mt-4">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setTemplate(null)
										}}
									>
										Change Template
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Step 2: Map divisions */}
						<Card>
							<CardHeader>
								<CardTitle>
									Step 2: Map Competition Divisions
								</CardTitle>
								<CardDescription>
									Map each competition's divisions to the
									series template. Unmapped divisions are
									excluded from the leaderboard.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{competitionMappings.length === 0 ? (
									<Alert
										variant="default"
										className="border-dashed"
									>
										<AlertTitle>
											No competitions in series
										</AlertTitle>
										<AlertDescription>
											Add competitions to this series
											first, then configure division
											mappings.
										</AlertDescription>
									</Alert>
								) : (
									<SeriesDivisionMapper
										groupId={groupId}
										template={template}
										initialMappings={competitionMappings}
									/>
								)}
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	)
}
