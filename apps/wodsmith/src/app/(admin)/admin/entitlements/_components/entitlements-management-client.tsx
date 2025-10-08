"use client"

import { useServerAction } from "@repo/zsa-react"
import { Building2, Crown, Shield, User } from "lucide-react"
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
import {
	getAllPlansAction,
	getAllTeamsWithPlansAction,
} from "../../_actions/entitlement-admin-actions"
import { ChangePlanDialog } from "./change-plan-dialog"
import { EntitlementOverridesDialog } from "./entitlement-overrides-dialog"

export function EntitlementsManagementClient() {
	const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
	const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
	const [isOverridesDialogOpen, setIsOverridesDialogOpen] = useState(false)

	const { execute: fetchTeams, data: teamsData, isPending: isLoadingTeams } =
		useServerAction(getAllTeamsWithPlansAction)

	const { execute: fetchPlans, data: plansData } =
		useServerAction(getAllPlansAction)

	useEffect(() => {
		fetchTeams({})
		fetchPlans({})
	}, [fetchTeams, fetchPlans])

	const teams = teamsData?.[0]?.data ?? []
	const plans = plansData?.[0]?.data ?? []

	const handleChangePlan = (teamId: string) => {
		setSelectedTeamId(teamId)
		setIsPlanDialogOpen(true)
	}

	const handleManageOverrides = (teamId: string) => {
		setSelectedTeamId(teamId)
		setIsOverridesDialogOpen(true)
	}

	const handlePlanChanged = () => {
		fetchTeams({})
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
					<CardTitle>All Teams</CardTitle>
					<CardDescription>
						View and manage plans for all teams in the system
					</CardDescription>
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
