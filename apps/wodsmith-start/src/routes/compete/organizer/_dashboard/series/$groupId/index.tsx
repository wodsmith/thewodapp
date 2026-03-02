import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { usePostHog } from "@/lib/posthog"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, ListPlus, Pencil, Plus, Trophy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AddCompetitionsToSeriesDialog } from "@/components/add-competitions-to-series-dialog"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import type { CompetitionRevenueData } from "@/components/organizer-competitions-list"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { SeriesRevenueSummary } from "@/components/series-competition-revenue-list"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { SeriesRevenueStats } from "@/server-fns/commerce-fns"
import {
	exportSeriesRevenueCsvFn,
	getSeriesRevenueStatsFn,
} from "@/server-fns/commerce-fns"
import {
	getCompetitionGroupByIdFn,
	getOrganizerCompetitionsFn,
	updateCompetitionFn,
} from "@/server-fns/competition-fns"
import {
	alignAllSeriesCompsFn,
	listScalingGroupsFn,
	setSeriesCanonicalScalingGroupFn,
	type ScalingGroupForTemplate,
} from "@/server-fns/competition-divisions-fns"
import { getSeriesQuestionsFn } from "@/server-fns/registration-questions-fns"
import type { SeriesDivisionHealth } from "@/server-fns/series-leaderboard-fns"
import { getSeriesDivisionHealthFn } from "@/server-fns/series-leaderboard-fns"
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"
import { parseSeriesSettings } from "@/types/competitions"

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/series/$groupId/",
)({
	component: SeriesDetailPage,
	loader: async ({ params, context }) => {
		const { groupId } = params
		const { teams: organizingTeams } = await getOrganizerTeamsFn()
		const isSiteAdmin = context.session?.user?.role === "admin"

		// Fetch group details (needed for both admin and normal flow)
		const groupResult = await getCompetitionGroupByIdFn({ data: { groupId } })

		if (!groupResult.group) {
			return {
				group: null,
				seriesCompetitions: [],
				allCompetitions: [],
				allGroups: [],
				seriesQuestions: [],
				scalingGroups: [],
				canonicalScalingGroupId: null,
				deferredRevenueStats: Promise.resolve(null),
				deferredDivisionHealth: Promise.resolve({ health: [], primaryScalingGroupId: null }),
				teamId: null,
			}
		}

		if (organizingTeams.length === 0 && !isSiteAdmin) {
			return {
				group: null,
				seriesCompetitions: [],
				allCompetitions: [],
				allGroups: [],
				seriesQuestions: [],
				scalingGroups: [],
				canonicalScalingGroupId: null,
				deferredRevenueStats: Promise.resolve(null),
				deferredDivisionHealth: Promise.resolve({ health: [], primaryScalingGroupId: null }),
				teamId: null,
			}
		}

		// Use the group's organizing team if the user has access, otherwise fall back
		const groupTeamId = groupResult.group.organizingTeamId
		let teamId: string
		if (isSiteAdmin || organizingTeams.some((t) => t.id === groupTeamId)) {
			teamId = groupTeamId
		} else {
			const activeTeamId = await getActiveTeamIdFn()
			teamId =
				organizingTeams.find((t) => t.id === activeTeamId)?.id ??
				organizingTeams[0].id
		}

		// Fetch competitions, series questions, and scaling groups in parallel
		const [competitionsResult, questionsResult, scalingGroupsResult] =
			await Promise.all([
				getOrganizerCompetitionsFn({ data: { teamId } }),
				getSeriesQuestionsFn({ data: { groupId } }),
				listScalingGroupsFn({ data: { teamId } }),
			])

		const seriesSettings = parseSeriesSettings(groupResult.group.settings)

		// Filter competitions that belong to this series
		const seriesCompetitions = competitionsResult.competitions.filter(
			(c) => c.groupId === groupId,
		)

		// Defer revenue stats and division health — not needed for initial render
		const deferredRevenueStats = getSeriesRevenueStatsFn({
			data: { groupId },
		})
		const deferredDivisionHealth = getSeriesDivisionHealthFn({
			data: {
				groupId,
				canonicalScalingGroupId: seriesSettings?.scalingGroupId ?? null,
			},
		})

		return {
			group: groupResult.group,
			seriesCompetitions,
			allCompetitions: competitionsResult.competitions,
			allGroups: [
				{ ...groupResult.group, competitionCount: seriesCompetitions.length },
			],
			seriesQuestions: questionsResult.questions,
			scalingGroups: scalingGroupsResult.groups,
			canonicalScalingGroupId: seriesSettings?.scalingGroupId ?? null,
			deferredRevenueStats,
			deferredDivisionHealth,
			teamId,
		}
	},
})

function SeriesDetailPage() {
	const {
		group,
		seriesCompetitions,
		allCompetitions,
		allGroups,
		seriesQuestions,
		scalingGroups,
		canonicalScalingGroupId: initialCanonicalGroupId,
		deferredRevenueStats,
		deferredDivisionHealth,
		teamId,
	} = Route.useLoaderData()
	const router = useRouter()
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [isExportingCsv, setIsExportingCsv] = useState(false)
	const [seriesRevenueStats, setSeriesRevenueStats] =
		useState<SeriesRevenueStats | null>(null)
	const [canonicalGroupId, setCanonicalGroupId] = useState<string | null>(
		initialCanonicalGroupId,
	)
	const [isSavingCanonical, setIsSavingCanonical] = useState(false)
	const [isFixingAll, setIsFixingAll] = useState(false)
	const [divisionHealth, setDivisionHealth] = useState<SeriesDivisionHealth[]>([])

	useEffect(() => {
		let cancelled = false
		deferredRevenueStats
			.then((data) => {
				if (!cancelled && data) {
					setSeriesRevenueStats(data)
				}
			})
			.catch(() => {
				// Revenue stats failed to load — section stays hidden
			})
		return () => {
			cancelled = true
		}
	}, [deferredRevenueStats])

	useEffect(() => {
		let cancelled = false
		deferredDivisionHealth
			.then((data) => {
				if (!cancelled) setDivisionHealth(data.health)
			})
			.catch(() => {
				// Division health failed to load — section stays hidden
			})
		return () => {
			cancelled = true
		}
	}, [deferredDivisionHealth])

	const revenueByCompetition = useMemo(() => {
		if (!seriesRevenueStats) return undefined
		const map = new Map<string, CompetitionRevenueData>()
		for (const comp of seriesRevenueStats.byCompetition) {
			map.set(comp.competitionId, {
				grossCents: comp.grossCents,
				organizerNetCents: comp.organizerNetCents,
				purchaseCount: comp.purchaseCount,
				byDivision: comp.byDivision,
			})
		}
		return map
	}, [seriesRevenueStats])

	const { posthog } = usePostHog()
	const globalLeaderboardEnabled =
		posthog.isFeatureEnabled("competition-global-leaderboard") !== false

	const updateCompetition = useServerFn(updateCompetitionFn)
	const exportCsv = useServerFn(exportSeriesRevenueCsvFn)
	const setCanonicalScalingGroup = useServerFn(setSeriesCanonicalScalingGroupFn)
	const alignAllComps = useServerFn(alignAllSeriesCompsFn)
	const fetchDivisionHealth = useServerFn(getSeriesDivisionHealthFn)

	const handleQuestionsChange = () => {
		router.invalidate()
	}

	const handleFixAll = async () => {
		if (!group || !teamId || !canonicalGroupId) return
		setIsFixingAll(true)
		try {
			const { results } = await alignAllComps({
				data: {
					groupId: group.id,
					teamId,
					targetScalingGroupId: canonicalGroupId,
				},
			})
			const failed = results.filter((r) => !r.success)
			if (failed.length === 0) {
				toast.success(`All competitions aligned to the selected division template`)
			} else {
				toast.warning(
					`${results.length - failed.length} updated, ${failed.length} failed`,
				)
			}
			// Refresh health data to update the mismatch list
			const refreshed = await fetchDivisionHealth({
				data: { groupId: group.id, canonicalScalingGroupId: canonicalGroupId },
			})
			setDivisionHealth(refreshed.health)
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to align competitions",
			)
		} finally {
			setIsFixingAll(false)
		}
	}

	const handleSetCanonical = async (scalingGroupId: string) => {
		if (!group || !teamId) return
		setIsSavingCanonical(true)
		try {
			await setCanonicalScalingGroup({
				data: { groupId: group.id, teamId, scalingGroupId },
			})
			setCanonicalGroupId(scalingGroupId)
			toast.success("Division template updated")
			// Refresh health so the mismatch list reflects the new canonical
			const refreshed = await fetchDivisionHealth({
				data: { groupId: group.id, canonicalScalingGroupId: scalingGroupId },
			})
			setDivisionHealth(refreshed.health)
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to update division template",
			)
		} finally {
			setIsSavingCanonical(false)
		}
	}

	const handleRemoveFromSeries = async (competitionId: string) => {
		try {
			await updateCompetition({
				data: {
					competitionId,
					groupId: null,
				},
			})
			toast.success("Competition removed from series")
			await router.invalidate()
		} catch (error) {
			console.error("Failed to remove competition from series:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove competition from series",
			)
		}
	}

	const handleExportCsv = async () => {
		if (!group) return
		setIsExportingCsv(true)
		try {
			const csv = await exportCsv({ data: { groupId: group.id } })
			const blob = new Blob([csv], { type: "text/csv" })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			const date = new Date().toISOString().split("T")[0]
			a.download = `series-revenue-${group.slug}-${date}.csv`
			a.click()
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error("Failed to export CSV:", error)
			toast.error("Failed to export CSV")
		} finally {
			setIsExportingCsv(false)
		}
	}

	if (!teamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
					<p className="text-muted-foreground mb-6">
						You need to be part of a team to view series details.
					</p>
				</div>
			</div>
		)
	}

	if (!group) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
					<p className="text-muted-foreground mb-6">
						The series you're looking for doesn't exist or you don't have
						permission to view it.
					</p>
					<Button variant="outline" asChild>
						<a href="/compete/organizer/series">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Series
						</a>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<div className="mb-4">
						<Button variant="ghost" size="sm" asChild>
							<a href="/compete/organizer/series">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Series
							</a>
						</Button>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">{group.name}</h1>
							{group.description && (
								<p className="text-muted-foreground mt-1">
									{group.description}
								</p>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{globalLeaderboardEnabled && (
								<Button variant="outline" asChild>
									<Link
										to="/compete/organizer/series/$groupId/leaderboard"
										params={{ groupId: group.id }}
									>
										<Trophy className="h-4 w-4 mr-2" />
										Global Leaderboard
									</Link>
								</Button>
							)}
							<Button variant="outline" asChild>
								<Link
									to="/compete/organizer/series/$groupId/edit"
									params={{ groupId: group.id }}
								>
									<Pencil className="h-4 w-4 mr-2" />
									Edit Series
								</Link>
							</Button>
							<Button
								variant="outline"
								onClick={() => setIsAddDialogOpen(true)}
							>
								<ListPlus className="h-4 w-4 mr-2" />
								Add Existing
							</Button>
							<Button asChild>
								<Link
									to="/compete/organizer/new"
									search={{ groupId: group.id }}
								>
									<Plus className="h-4 w-4 mr-2" />
									Create New
								</Link>
							</Button>
						</div>
					</div>
				</div>

				{/* Revenue Summary */}
				{seriesRevenueStats ? (
					<SeriesRevenueSummary
						stats={seriesRevenueStats}
						onExportCsv={handleExportCsv}
						isExporting={isExportingCsv}
					/>
				) : (
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
							{[0, 1, 2].map((i) => (
								<Card key={i} className={i === 2 ? "col-span-2 sm:col-span-1" : ""}>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-4 w-4 rounded" />
									</CardHeader>
									<CardContent>
										<Skeleton className="h-8 w-28 mb-1" />
										<Skeleton className="h-3 w-32" />
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* Series Info Card */}
				<Card>
					<CardHeader>
						<CardTitle>Series Details</CardTitle>
						<CardDescription>Information about this series</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Slug
								</div>
								<div className="text-sm font-mono mt-1">{group.slug}</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Competitions
								</div>
								<div className="text-sm mt-1">
									{seriesCompetitions.length} competition
									{seriesCompetitions.length !== 1 ? "s" : ""}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Division Settings */}
				{scalingGroups.length > 0 && globalLeaderboardEnabled && (
					<Card>
						<CardHeader>
							<CardTitle>Division Settings</CardTitle>
							<CardDescription>
								Set the canonical division template for this series. All
								competitions should use this template so athletes can be compared
								on the global leaderboard.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-3">
								<Select
									value={canonicalGroupId ?? "__none__"}
									onValueChange={(val) => {
										if (val !== "__none__") handleSetCanonical(val)
									}}
									disabled={isSavingCanonical}
								>
									<SelectTrigger className="w-[320px]">
										<SelectValue placeholder="Select a division template..." />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none__" disabled>
											Select a division template...
										</SelectItem>
										{scalingGroups.map((g: ScalingGroupForTemplate) => (
											<SelectItem key={g.id} value={g.id}>
												{g.title}
												{g.levels.length > 0 && (
													<span className="ml-1 text-muted-foreground text-xs">
														({g.levels.map((l) => l.label).join(", ")})
													</span>
												)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{isSavingCanonical && (
									<span className="text-sm text-muted-foreground animate-pulse">
										Saving...
									</span>
								)}
								{canonicalGroupId && !isSavingCanonical && (
									<Button
										variant="outline"
										size="sm"
										onClick={handleFixAll}
										disabled={isFixingAll}
									>
										{isFixingAll ? "Fixing..." : "Fix All Competitions"}
									</Button>
								)}
							</div>
							{/* Mismatched competitions list */}
							{divisionHealth.filter((h) => !h.matchesPrimary).length > 0 && (
								<div className="mt-4 space-y-1">
									<p className="text-sm font-medium text-destructive">
										{divisionHealth.filter((h) => !h.matchesPrimary).length}{" "}
										competition
										{divisionHealth.filter((h) => !h.matchesPrimary).length !== 1
											? "s"
											: ""}{" "}
										not using the canonical template:
									</p>
									<ul className="space-y-1">
										{divisionHealth
											.filter((h) => !h.matchesPrimary)
											.map((h) => (
												<li
													key={h.competitionId}
													className="flex items-center justify-between text-sm"
												>
													<span className="text-muted-foreground">
														{h.competitionName}
													</span>
													<Link
														to="/compete/organizer/$competitionId/divisions"
														params={{ competitionId: h.competitionId }}
														className="text-xs underline text-muted-foreground hover:text-foreground"
													>
														Fix →
													</Link>
												</li>
											))}
									</ul>
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* Series Registration Questions */}
				<RegistrationQuestionsEditor
					entityType="series"
					entityId={group.id}
					teamId={teamId}
					questions={seriesQuestions}
					onQuestionsChange={handleQuestionsChange}
				/>

				{/* Competitions in Series */}
				<div>
					<h2 className="text-xl font-bold mb-4">Competitions in Series</h2>
					<OrganizerCompetitionsList
						competitions={seriesCompetitions}
						groups={allGroups}
						teamId={teamId}
						currentGroupId={group.id}
						onRemoveFromSeries={handleRemoveFromSeries}
						revenueByCompetition={revenueByCompetition}
					/>
				</div>
			</div>

			{/* Add Existing Competitions Dialog */}
			<AddCompetitionsToSeriesDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				groupId={group.id}
				groupName={group.name}
				allCompetitions={allCompetitions}
				currentSeriesCompetitions={seriesCompetitions}
			/>
		</div>
	)
}
