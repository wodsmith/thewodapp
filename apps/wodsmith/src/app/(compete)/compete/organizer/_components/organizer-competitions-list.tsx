"use client"

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
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
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
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
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
import { deleteCompetitionAction } from "@/actions/competition-actions"

interface OrganizerCompetitionsListProps {
	competitions: Competition[]
	groups: Array<CompetitionGroup & { competitionCount: number }>
	teamId: string
	currentGroupId?: string
}

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

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(date))
	}

	return (
		<>
			<div className="flex flex-col gap-4">
				{/* Group filter */}
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

				{competitions.length > 0 && (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{competitions.map((competition) => (
							<Card
								key={competition.id}
								className="hover:bg-accent/50 transition-colors"
							>
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0">
											<Link href={`/compete/organizer/${competition.id}`}>
												<CardTitle className="truncate hover:underline">
													{competition.name}
												</CardTitle>
											</Link>
											<CardDescription className="mt-1 flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												<span>
													{formatDate(competition.startDate)} -{" "}
													{formatDate(competition.endDate)}
												</span>
											</CardDescription>
											{competition.groupId && (
												<CardDescription className="mt-1">
													Series:{" "}
													{groups.find((g) => g.id === competition.groupId)
														?.name || "Unknown"}
												</CardDescription>
											)}
										</div>
										<DropdownMenu>
											<DropdownMenuTrigger
												asChild
												onClick={(e) => e.preventDefault()}
											>
												<Button variant="ghost" size="sm">
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
								</CardHeader>
								{competition.description && (
									<CardContent>
										<p className="text-sm text-muted-foreground line-clamp-2">
											{competition.description}
										</p>
									</CardContent>
								)}
							</Card>
						))}
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
