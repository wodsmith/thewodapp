"use client"

import { useServerAction } from "@repo/zsa-react"
import {
	Calendar,
	ExternalLink,
	Filter,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	Trophy,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { deleteCompetitionAction } from "@/actions/competition-actions"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Competition, CompetitionGroup } from "@/db/schema"
import { formatUTCDateFull } from "@/utils/date-utils"

interface OrganizerCompetitionsListProps {
	competitions: Competition[]
	groups: Array<CompetitionGroup & { competitionCount: number }>
	teamId: string
	currentGroupId?: string
}

type StatusFilter = "all" | "current" | "past"

export function OrganizerCompetitionsList({
	competitions,
	groups,
	teamId,
	currentGroupId,
}: OrganizerCompetitionsListProps) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const [deleteCompetitionId, setDeleteCompetitionId] = useState<string | null>(
		null,
	)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

	const { execute: deleteCompetition, isPending: isDeleting } = useServerAction(
		deleteCompetitionAction,
		{
			onSuccess: () => {
				toast.success("Competition deleted successfully")
				setDeleteCompetitionId(null)
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete competition")
			},
		},
	)

	const handleDelete = (competitionId: string) => {
		deleteCompetition({ competitionId, organizingTeamId: teamId })
	}

	const handleGroupFilter = (value: string) => {
		const params = new URLSearchParams(searchParams.toString())
		if (value === "all") {
			params.delete("groupId")
		} else {
			params.set("groupId", value)
		}
		router.push(`/compete/organizer?${params.toString()}`)
	}

	// Filter and sort competitions
	const filteredAndSortedCompetitions = useMemo(() => {
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

		// Sort by createdAt descending (most recent first)
		filtered.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)

		return filtered
	}, [competitions, statusFilter])

	return (
		<>
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
						<CardContent className="pt-6">
							<div className="text-center py-12">
								<Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium mb-2">
									No competitions yet
								</h3>
								<p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
									Create your first competition to start managing registrations,
									divisions, and more.
								</p>
								<Link href="/compete/organizer/new">
									<Button>
										<Plus className="h-4 w-4 mr-2" />
										Create Competition
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Linear list of competitions */}
				{filteredAndSortedCompetitions.length > 0 && (
					<div className="space-y-2">
						{filteredAndSortedCompetitions.map((competition) => {
							const seriesName = groups.find(
								(g) => g.id === competition.groupId,
							)?.name
							const _isCurrent = (() => {
								const today = new Date()
								today.setHours(0, 0, 0, 0)
								const normalizedEndDate = new Date(competition.endDate)
								normalizedEndDate.setHours(0, 0, 0, 0)
								return normalizedEndDate >= today
							})()

							return (
								<div
									key={competition.id}
									className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors"
								>
									<div className="flex-1 min-w-0">
										<div className="flex flex-col gap-1">
											<Link href={`/compete/organizer/${competition.id}`}>
												<h3 className="font-medium text-sm text-foreground hover:underline truncate">
													{competition.name}
												</h3>
											</Link>
											<div className="flex flex-wrap items-center gap-2">
												<div className="flex items-center gap-1 text-xs text-muted-foreground">
													<Calendar className="h-3 w-3" />
													<span>
														{formatUTCDateFull(competition.startDate)} -{" "}
														{formatUTCDateFull(competition.endDate)}
													</span>
												</div>
												{seriesName && (
													<Badge variant="secondary" className="text-xs">
														{seriesName}
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
													<Link href={`/compete/${competition.slug}`}>
														<ExternalLink className="h-4 w-4 mr-2" />
														View Public Page
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem asChild>
													<Link href={`/compete/organizer/${competition.id}`}>
														<Pencil className="h-4 w-4 mr-2" />
														Manage
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem asChild>
													<Link
														href={`/compete/organizer/${competition.id}/edit`}
													>
														<Pencil className="h-4 w-4 mr-2" />
														Edit Details
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => setDeleteCompetitionId(competition.id)}
													className="text-destructive"
												>
													<Trash2 className="h-4 w-4 mr-2" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							)
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

			<AlertDialog
				open={deleteCompetitionId !== null}
				onOpenChange={(open) => !open && setDeleteCompetitionId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Competition?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							competition and all associated data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								deleteCompetitionId && handleDelete(deleteCompetitionId)
							}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
