/**
 * Admin Team Overview Page
 *
 * Shows detailed information about a team for platform administrators.
 * Displays team stats, members, and settings.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { format } from "date-fns"
import { Calendar, CreditCard, Mail, Trophy, User, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { OrganizerFeeCard } from "./-components/organizer-fee-card"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/admin/teams/$teamId")

export const Route = createFileRoute("/admin/teams/$teamId/")({
	component: AdminTeamOverviewPage,
})

function getRoleBadgeVariant(
	roleId: string,
): "default" | "secondary" | "outline" {
	// Use string literals instead of importing SYSTEM_ROLES_ENUM to avoid bundling issues
	switch (roleId) {
		case "owner":
		case "admin":
			return "default"
		case "captain":
			return "secondary"
		default:
			return "outline"
	}
}

function AdminTeamOverviewPage() {
	// Get team data from parent route
	const { team } = parentRoute.useLoaderData()

	const activeMemberships = team.memberships.filter(
		(m: { isActive: number }) => m.isActive === 1,
	)

	return (
		<div className="space-y-6">
			{/* Quick Stats */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-1">
							<Users className="h-4 w-4" />
							Members
						</CardDescription>
						<CardTitle className="text-2xl">
							{activeMemberships.length}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-1">
							<Trophy className="h-4 w-4" />
							Competitions
						</CardDescription>
						<CardTitle className="text-2xl">{team.competitionCount}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-1">
							<CreditCard className="h-4 w-4" />
							Credits
						</CardDescription>
						<CardTitle className="text-2xl">
							{team.creditBalance ?? 0}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-1">
							<Calendar className="h-4 w-4" />
							Created
						</CardDescription>
						<CardTitle className="text-lg">
							{team.createdAt
								? format(new Date(team.createdAt), "MMM d, yyyy")
								: "N/A"}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Team Details */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Team Information */}
				<Card>
					<CardHeader>
						<CardTitle>Team Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Team ID
							</p>
							<p className="font-mono text-sm">{team.id}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Slug</p>
							<p>{team.slug}</p>
						</div>
						{team.description && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Description
								</p>
								<p>{team.description}</p>
							</div>
						)}
						{team.billingEmail && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Billing Email
								</p>
								<p className="flex items-center gap-1">
									<Mail className="h-4 w-4" />
									{team.billingEmail}
								</p>
							</div>
						)}
						{team.currentPlanId && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Current Plan
								</p>
								<p>{team.currentPlanId}</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Stripe Connect Status */}
				<Card>
					<CardHeader>
						<CardTitle>Stripe Connect</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Account Status
							</p>
							<div className="mt-1">
								{team.stripeAccountStatus ? (
									<Badge
										variant={
											team.stripeAccountStatus === "VERIFIED"
												? "default"
												: team.stripeAccountStatus === "PENDING"
													? "secondary"
													: "outline"
										}
									>
										{team.stripeAccountStatus}
									</Badge>
								) : (
									<Badge variant="outline">Not Connected</Badge>
								)}
							</div>
						</div>
						{team.stripeConnectedAccountId && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Account ID
								</p>
								<p className="font-mono text-sm">
									{team.stripeConnectedAccountId}
								</p>
							</div>
						)}
						{team.stripeAccountType && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Account Type
								</p>
								<p className="capitalize">{team.stripeAccountType}</p>
							</div>
						)}
						{team.stripeOnboardingCompletedAt && (
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Onboarding Completed
								</p>
								<p>
									{format(
										new Date(team.stripeOnboardingCompletedAt),
										"MMM d, yyyy",
									)}
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Organizer Fee Settings - Only show for gym/competition teams */}
			{team.type === "gym" || team.type === "competition_event" ? (
				<OrganizerFeeCard team={team} />
			) : null}

			{/* Team Members */}
			<Card>
				<CardHeader>
					<CardTitle>Members</CardTitle>
					<CardDescription>
						{activeMemberships.length} active member
						{activeMemberships.length !== 1 ? "s" : ""}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{activeMemberships.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<User className="h-8 w-8 mb-2 opacity-50" />
							<p>No members found</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{activeMemberships.map(
									(membership: {
										id: string
										roleId: string
										isSystemRole: number
										joinedAt: Date | null
										user: {
											id: string
											email: string
											firstName: string | null
											lastName: string | null
										}
									}) => (
										<TableRow key={membership.id}>
											<TableCell>
												<div>
													<p className="font-medium">
														{membership.user.firstName &&
														membership.user.lastName
															? `${membership.user.firstName} ${membership.user.lastName}`
															: membership.user.email}
													</p>
													{membership.user.firstName &&
														membership.user.lastName && (
															<p className="text-xs text-muted-foreground">
																{membership.user.email}
															</p>
														)}
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={getRoleBadgeVariant(membership.roleId)}>
													{membership.roleId}
													{!membership.isSystemRole && (
														<span className="ml-1 text-xs">(custom)</span>
													)}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{membership.joinedAt
													? format(new Date(membership.joinedAt), "MMM d, yyyy")
													: "N/A"}
											</TableCell>
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
