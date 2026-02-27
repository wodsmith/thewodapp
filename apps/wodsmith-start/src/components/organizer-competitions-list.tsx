"use client"

import { useNavigate, useSearch } from "@tanstack/react-router"
import {
	Calendar,
	ChevronDown,
	ExternalLink,
	Filter,
	Pencil,
	Plus,
	Trophy,
	X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { CompetitionWithRelations } from "@/server-fns/competition-fns"
import { cn } from "@/utils/cn"
import { isSameUTCDay } from "@/utils/date-utils"

interface CompetitionGroup {
	id: string
	name: string
	competitionCount?: number
}

export interface CompetitionRevenueData {
	grossCents: number
	organizerNetCents: number
	purchaseCount: number
	byDivision: Array<{
		divisionId: string
		divisionLabel: string
		purchaseCount: number
		registrationFeeCents: number
		grossCents: number
		platformFeeCents: number
		stripeFeeCents: number
		organizerNetCents: number
	}>
}

interface OrganizerCompetitionsListProps {
	competitions: CompetitionWithRelations[]
	groups: CompetitionGroup[]
	teamId: string
	currentGroupId?: string
	/** When provided, shows "Remove from series" instead of delete */
	onRemoveFromSeries?: (competitionId: string) => void
	/** Revenue data keyed by competitionId — shows inline gross/net + expandable division breakdown */
	revenueByCompetition?: Map<string, CompetitionRevenueData>
}

type StatusFilter = "all" | "current" | "past"

/**
 * Format a date to full readable format (e.g., "January 1, 2025")
 */
function formatDateFull(date: Date | string | number): string {
	const dateObj = date instanceof Date ? date : new Date(date)
	return dateObj.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	})
}

function formatCents(cents: number): string {
	return (cents / 100).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	})
}

export function OrganizerCompetitionsList({
	competitions,
	groups,
	teamId: _teamId,
	currentGroupId,
	onRemoveFromSeries,
	revenueByCompetition,
}: OrganizerCompetitionsListProps) {
	const navigate = useNavigate()
	const searchParams = useSearch({ strict: false }) as any
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

	const hasRevenue = revenueByCompetition && revenueByCompetition.size > 0

	function toggleExpanded(id: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}

	// Series mode: show remove action instead of delete
	const isSeriesMode = !!onRemoveFromSeries

	const handleGroupFilter = (value: string) => {
		const newParams = { ...searchParams }
		if (value === "all") {
			delete newParams.groupId
		} else {
			newParams.groupId = value
		}
		navigate({
			to: "/compete/organizer",
			search: newParams as any,
		})
	}

	// Filter and sort competitions
	const filteredAndSortedCompetitions = useMemo(() => {
		const isCurrentCompetition = (endDate: Date | string) => {
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			const normalizedEndDate = new Date(endDate)
			normalizedEndDate.setHours(0, 0, 0, 0)
			return normalizedEndDate >= today
		}

		let filtered = [...competitions]

		// Apply status filter
		if (statusFilter === "current") {
			filtered = filtered.filter((c) => isCurrentCompetition(c.endDate))
		} else if (statusFilter === "past") {
			filtered = filtered.filter((c) => !isCurrentCompetition(c.endDate))
		}

		// Sort by createdAt descending (most recent first)
		filtered.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)

		return filtered
	}, [competitions, statusFilter])

	return (
		<div className="flex flex-col gap-6">
			{/* Filters section */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{/* Status filter tabs */}
				<div className="flex gap-2">
					{(["all", "current", "past"] as const).map((filter) => (
						<Button
							key={filter}
							variant={statusFilter === filter ? "default" : "outline"}
							size="sm"
							onClick={() => setStatusFilter(filter)}
							className="capitalize"
						>
							{filter === "all" && "All"}
							{filter === "current" && "Current"}
							{filter === "past" && "Past"}
						</Button>
					))}
				</div>

				{/* Series filter */}
				{groups.length > 0 && (
					<div className="flex items-center gap-2">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<Select
							value={currentGroupId || "all"}
							onValueChange={handleGroupFilter}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="Filter by series" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Competitions</SelectItem>
								{groups.map((group) => (
									<SelectItem key={group.id} value={group.id}>
										{group.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			{/* Empty state */}
			{competitions.length === 0 && (
				<Card>
					<div className="pt-6">
						<div className="text-center py-12">
							<Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium mb-2">No competitions yet</h3>
							<p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
								Create your first competition to start managing registrations,
								divisions, and more.
							</p>
							<a href="/compete/organizer/new">
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Create Competition
								</Button>
							</a>
						</div>
					</div>
				</Card>
			)}

			{/* Linear list of competitions */}
			{filteredAndSortedCompetitions.length > 0 && (
				<div className="space-y-2">
					{filteredAndSortedCompetitions.map((competition) => {
						const seriesName = groups.find(
							(g) => g.id === competition.groupId,
						)?.name
						const revenue = revenueByCompetition?.get(competition.id)
						const isExpanded = expandedIds.has(competition.id)
						const canExpand =
							hasRevenue && revenue && revenue.byDivision.length > 0

						const row = (
							<div
								className={cn(
									"group flex items-center justify-between px-4 py-3 transition-colors",
									canExpand
										? "hover:bg-muted/50 cursor-pointer"
										: "hover:bg-accent",
									!canExpand && "rounded-lg border border-border bg-card",
								)}
							>
								<div className="flex-1 min-w-0">
									<div className="flex flex-col gap-1">
										<a
											href={`/compete/organizer/${competition.id}`}
											onClick={(e) => e.stopPropagation()}
										>
											<h3 className="font-medium text-sm text-foreground hover:underline truncate">
												{competition.name}
											</h3>
										</a>
										<div className="flex flex-wrap items-center gap-2">
											<div className="flex items-center gap-1 text-xs text-muted-foreground">
												<Calendar className="h-3 w-3" />
												<span>
													{isSameUTCDay(
														competition.startDate,
														competition.endDate,
													)
														? formatDateFull(competition.startDate)
														: `${formatDateFull(competition.startDate)} - ${formatDateFull(competition.endDate)}`}
												</span>
											</div>
											{seriesName && (
												<Badge variant="secondary" className="text-xs">
													{seriesName}
												</Badge>
											)}
											{revenue && (
												<span className="text-xs text-muted-foreground">
													{revenue.purchaseCount} athlete
													{revenue.purchaseCount !== 1 ? "s" : ""}
												</span>
											)}
										</div>
									</div>
								</div>

								<div className="ml-4 flex-shrink-0 flex items-center gap-4">
									{/* Revenue inline */}
									{revenue && (
										<div className="hidden sm:flex items-center gap-4">
											<div className="flex flex-col items-end gap-0.5">
												<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
													Gross
												</span>
												<span className="text-sm font-medium">
													{formatCents(revenue.grossCents)}
												</span>
											</div>
											<div className="flex flex-col items-end gap-0.5">
												<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
													Net
												</span>
												<span className="text-sm font-medium text-green-600">
													{formatCents(revenue.organizerNetCents)}
												</span>
											</div>
										</div>
									)}

									{/* Expand chevron */}
									{canExpand && (
										<ChevronDown
											className={cn(
												"h-4 w-4 text-muted-foreground transition-transform duration-200",
												isExpanded && "rotate-180",
											)}
										/>
									)}

									{/* Actions */}
									<div className="flex gap-1">
										<a
											href={`/compete/${competition.slug}`}
											onClick={(e) => e.stopPropagation()}
										>
											<Button
												variant="ghost"
												size="sm"
												title="View Public Page"
											>
												<ExternalLink className="h-4 w-4" />
											</Button>
										</a>
										<a
											href={`/compete/organizer/${competition.id}`}
											onClick={(e) => e.stopPropagation()}
										>
											<Button variant="ghost" size="sm" title="Manage">
												<Pencil className="h-4 w-4" />
											</Button>
										</a>
										{isSeriesMode && (
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation()
													onRemoveFromSeries(competition.id)
												}}
												title="Remove from series"
											>
												<X className="h-4 w-4" />
											</Button>
										)}
									</div>
								</div>
							</div>
						)

						if (canExpand) {
							return (
								<Collapsible
									key={competition.id}
									open={isExpanded}
									onOpenChange={() => toggleExpanded(competition.id)}
								>
									<Card>
										<CollapsibleTrigger asChild>
											<button type="button" className="w-full text-left">
												{row}
											</button>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<div className="px-4 pb-4">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Division</TableHead>
															<TableHead className="text-right">
																Athletes
															</TableHead>
															<TableHead className="text-right">
																Ticket Price
															</TableHead>
															<TableHead className="text-right">
																Gross
															</TableHead>
															<TableHead className="text-right text-red-400">
																Platform Fee
															</TableHead>
															<TableHead className="text-right text-red-400">
																Stripe Fee
															</TableHead>
															<TableHead className="text-right">Net</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{revenue.byDivision.map((division) => (
															<TableRow key={division.divisionId}>
																<TableCell className="font-medium">
																	{division.divisionLabel}
																</TableCell>
																<TableCell className="text-right">
																	{division.purchaseCount}
																</TableCell>
																<TableCell className="text-right text-muted-foreground">
																	{formatCents(division.registrationFeeCents)}
																</TableCell>
																<TableCell className="text-right">
																	{formatCents(division.grossCents)}
																</TableCell>
																<TableCell className="text-right text-red-400">
																	-{formatCents(division.platformFeeCents)}
																</TableCell>
																<TableCell className="text-right text-red-400">
																	-{formatCents(division.stripeFeeCents)}
																</TableCell>
																<TableCell className="text-right text-green-600">
																	{formatCents(division.organizerNetCents)}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</CollapsibleContent>
									</Card>
								</Collapsible>
							)
						}

						return <div key={competition.id}>{row}</div>
					})}
				</div>
			)}

			{/* No results for filter state */}
			{competitions.length > 0 &&
				filteredAndSortedCompetitions.length === 0 && (
					<div className="text-center py-8">
						<Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
						<p className="text-sm text-muted-foreground">
							No{" "}
							{statusFilter === "current"
								? "current"
								: statusFilter === "past"
									? "past"
									: ""}{" "}
							competitions found
						</p>
					</div>
				)}
		</div>
	)
}
