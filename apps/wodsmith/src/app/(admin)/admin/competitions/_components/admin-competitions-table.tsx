"use client"

import {
	Calendar,
	ExternalLink,
	MoreHorizontal,
	Search,
	Settings,
	Trophy,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"
import { formatUTCDateFull } from "@/utils/date-utils"

type AdminCompetition = Competition & {
	organizingTeam: Team | null
	competitionTeam: Team | null
	group: CompetitionGroup | null
}

interface AdminCompetitionsTableProps {
	competitions: AdminCompetition[]
}

type StatusFilter = "all" | "current" | "past"

/**
 * Admin competitions table component.
 * Shows all competitions across all organizers with filtering and search.
 * NO delete functionality - admin should not delete competitions arbitrarily.
 */
export function AdminCompetitionsTable({
	competitions,
}: AdminCompetitionsTableProps) {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
	const [searchQuery, setSearchQuery] = useState("")

	// Filter and sort competitions
	const filteredCompetitions = useMemo(() => {
		const isCurrentCompetition = (endDate: Date) => {
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

		// Apply search filter (competition name or organizer name)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim()
			filtered = filtered.filter(
				(c) =>
					c.name.toLowerCase().includes(query) ||
					c.organizingTeam?.name?.toLowerCase().includes(query),
			)
		}

		// Sort by createdAt descending (most recent first)
		filtered.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)

		return filtered
	}, [competitions, statusFilter, searchQuery])

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

				{/* Search input */}
				<div className="relative w-full sm:w-64">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search competitions or organizers..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>

			{/* Empty state */}
			{competitions.length === 0 && (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center py-12">
							<Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium mb-2">No competitions yet</h3>
							<p className="text-sm text-muted-foreground max-w-sm mx-auto">
								No competitions have been created by any organizers yet.
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Competitions list */}
			{filteredCompetitions.length > 0 && (
				<div className="space-y-2">
					{filteredCompetitions.map((competition) => (
						<CompetitionRow key={competition.id} competition={competition} />
					))}
				</div>
			)}

			{/* No results for filter state */}
			{competitions.length > 0 && filteredCompetitions.length === 0 && (
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
						{searchQuery && ` matching "${searchQuery}"`}
					</p>
				</div>
			)}
		</div>
	)
}

function CompetitionRow({ competition }: { competition: AdminCompetition }) {
	return (
		<div className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors">
			<div className="flex-1 min-w-0">
				<div className="flex flex-col gap-1">
					{/* Competition name and link */}
					<Link href={`/compete/organizer/${competition.id}`}>
						<h3 className="font-medium text-sm text-foreground hover:underline truncate">
							{competition.name}
						</h3>
					</Link>

					{/* Metadata row */}
					<div className="flex flex-wrap items-center gap-2">
						{/* Organizing team */}
						{competition.organizingTeam && (
							<span className="text-xs text-muted-foreground">
								by {competition.organizingTeam.name}
							</span>
						)}

						{/* Dates */}
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Calendar className="h-3 w-3" />
							<span>
								{formatUTCDateFull(competition.startDate)} -{" "}
								{formatUTCDateFull(competition.endDate)}
							</span>
						</div>

						{/* Status badge */}
						<Badge
							variant={
								competition.status === "published" ? "default" : "secondary"
							}
							className="text-xs"
						>
							{competition.status}
						</Badge>

						{/* Visibility badge */}
						<Badge
							variant={
								competition.visibility === "public" ? "outline" : "secondary"
							}
							className="text-xs"
						>
							{competition.visibility}
						</Badge>

						{/* Series name if in a group */}
						{competition.group && (
							<Badge variant="secondary" className="text-xs">
								{competition.group.name}
							</Badge>
						)}
					</div>
				</div>
			</div>

			{/* Actions dropdown */}
			<div className="ml-4 flex-shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem asChild>
							<Link href={`/compete/organizer/${competition.id}`}>
								<Settings className="h-4 w-4 mr-2" />
								Manage as Organizer
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link href={`/compete/${competition.slug}`}>
								<ExternalLink className="h-4 w-4 mr-2" />
								View Public Page
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	)
}
