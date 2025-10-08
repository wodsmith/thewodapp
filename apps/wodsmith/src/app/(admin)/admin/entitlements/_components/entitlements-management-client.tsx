"use client"

import { useServerAction } from "@repo/zsa-react"
import { Building2, Crown, Search, Shield, User } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
	getAllPlansAction,
	getAllTeamsWithPlansAction,
} from "../../_actions"
import { ChangePlanDialog } from "./change-plan-dialog"
import { EntitlementOverridesDialog } from "./entitlement-overrides-dialog"

export function EntitlementsManagementClient() {
	const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
	const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
	const [isOverridesDialogOpen, setIsOverridesDialogOpen] = useState(false)
	const [showPersonalTeams, setShowPersonalTeams] = useState(false)
	const [page, setPage] = useState(1)
	const [pageSize] = useState(50)
	const [search, setSearch] = useState("")
	const [searchInput, setSearchInput] = useState("")

	const { execute: fetchTeams, data: teamsData, isPending: isLoadingTeams } =
		useServerAction(getAllTeamsWithPlansAction)

	const { execute: fetchPlans, data: plansData } =
		useServerAction(getAllPlansAction)

	useEffect(() => {
		fetchTeams({ page, pageSize, search, showPersonalTeams })
		fetchPlans()
	}, [fetchTeams, fetchPlans, page, pageSize, search, showPersonalTeams])

	const teams = teamsData?.data?.teams ?? []
	const totalCount = teamsData?.data?.totalCount ?? 0
	const totalPages = teamsData?.data?.totalPages ?? 0
	const plans = plansData?.data ?? []

	const handleSearch = () => {
		setSearch(searchInput)
		setPage(1) // Reset to first page on search
	}

	const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch()
		}
	}

	const handleChangePlan = (teamId: string) => {
		setSelectedTeamId(teamId)
		setIsPlanDialogOpen(true)
	}

	const handleManageOverrides = (teamId: string) => {
		setSelectedTeamId(teamId)
		setIsOverridesDialogOpen(true)
	}

	const handlePlanChanged = () => {
		fetchTeams({ page, pageSize, search, showPersonalTeams })
		setIsPlanDialogOpen(false)
	}

	const getPlanBadgeVariant = (
		planId: string | null,
	): "default" | "secondary" | "outline" => {
		if (planId === "free") return "outline"
		if (planId === "pro") return "default"
		if (planId === "enterprise") return "secondary"
		return "outline"
	}

	const getPlanIcon = (planId: string | null) => {
		if (planId === "free") return <User className="w-3 h-3" />
		if (planId === "pro") return <Shield className="w-3 h-3" />
		if (planId === "enterprise") return <Crown className="w-3 h-3" />
		return <Building2 className="w-3 h-3" />
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle>All Teams</CardTitle>
							<CardDescription>
								View and manage plans for all teams in the system
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="show-personal"
								checked={showPersonalTeams}
								onCheckedChange={(checked) => {
									setShowPersonalTeams(!!checked)
									setPage(1)
								}}
							/>
							<Label htmlFor="show-personal" className="cursor-pointer">
								Show personal teams
							</Label>
						</div>
					</div>

					{/* Search */}
					<div className="flex gap-2 mt-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								placeholder="Search by team name or slug..."
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								onKeyDown={handleSearchKeyDown}
								className="pl-9"
							/>
						</div>
						<Button onClick={handleSearch} variant="secondary">
							Search
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{isLoadingTeams ? (
						<div className="text-center py-8">
							<p className="text-muted-foreground">Loading teams...</p>
						</div>
					) : teams.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-muted-foreground">No teams found</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Team</TableHead>
									<TableHead>Slug</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Current Plan</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{teams.map((team) => (
									<TableRow key={team.id}>
										<TableCell className="font-medium">{team.name}</TableCell>
										<TableCell className="font-mono text-sm">
											{team.slug}
										</TableCell>
										<TableCell>
											{team.isPersonalTeam ? (
												<Badge variant="outline">Personal</Badge>
											) : (
												<Badge variant="secondary">Gym</Badge>
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant={getPlanBadgeVariant(team.currentPlanId)}
												className="flex items-center gap-1 w-fit"
											>
												{getPlanIcon(team.currentPlanId)}
												{team.currentPlanId || "No Plan"}
											</Badge>
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{team.createdAt
												? new Date(team.createdAt).toLocaleDateString()
												: "N/A"}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleChangePlan(team.id)}
												>
													Change Plan
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleManageOverrides(team.id)}
												>
													Overrides
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}

					{/* Pagination */}
					{!isLoadingTeams && teams.length > 0 && (
						<div className="flex items-center justify-between mt-4 pt-4 border-t">
							<div className="text-sm text-muted-foreground">
								Showing {(page - 1) * pageSize + 1} to{" "}
								{Math.min(page * pageSize, totalCount)} of {totalCount} teams
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPage(page - 1)}
									disabled={page === 1}
								>
									Previous
								</Button>
								<div className="flex items-center gap-1">
									{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										// Show first, last, current, and adjacent pages
										let pageNum: number
										if (totalPages <= 5) {
											pageNum = i + 1
										} else if (page <= 3) {
											pageNum = i + 1
										} else if (page >= totalPages - 2) {
											pageNum = totalPages - 4 + i
										} else {
											pageNum = page - 2 + i
										}

										return (
											<Button
												key={pageNum}
												variant={page === pageNum ? "default" : "outline"}
												size="sm"
												onClick={() => setPage(pageNum)}
											>
												{pageNum}
											</Button>
										)
									})}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPage(page + 1)}
									disabled={page === totalPages}
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{selectedTeamId && (
				<>
					<ChangePlanDialog
						open={isPlanDialogOpen}
						onOpenChange={setIsPlanDialogOpen}
						teamId={selectedTeamId}
						currentPlanId={
							teams.find((t) => t.id === selectedTeamId)?.currentPlanId ?? null
						}
						plans={plans}
						onSuccess={handlePlanChanged}
					/>

					<EntitlementOverridesDialog
						open={isOverridesDialogOpen}
						onOpenChange={setIsOverridesDialogOpen}
						teamId={selectedTeamId}
						teamName={teams.find((t) => t.id === selectedTeamId)?.name ?? ""}
					/>
				</>
			)}
		</>
	)
}
