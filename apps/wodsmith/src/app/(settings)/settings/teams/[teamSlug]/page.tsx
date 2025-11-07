import { Alert } from "@heroui/react"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { InviteMemberModal } from "@/components/teams/invite-member-modal"
import { RemoveMemberButton } from "@/components/teams/remove-member-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getTeamMembers } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamMembership, hasTeamPermission } from "@/utils/team-auth"
import { TeamInvitations } from "./_components/team-invitations"
import { TeamMemberCard } from "./_components/team-members"
import { TeamEntitlements } from "./_components/team-entitlements"

interface TeamPageProps {
	params: Promise<{
		teamSlug: string
	}>
}

// TODO Test the removal process
export async function generateMetadata({ params }: TeamPageProps) {
	const { teamSlug } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
	})

	if (!team) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `${team.name} - Dashboard`,
		description: team.description || `Team dashboard for ${team.name}`,
	}
}

export default async function TeamDashboardPage({ params }: TeamPageProps) {
	const { teamSlug } = await params
	const db = getDb()

	// Find the team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
	})

	if (!team) {
		notFound()
	}

	// Check if user is authenticated
	const session = await getSessionFromCookie()
	if (!session) {
		redirect(
			`/auth/login?returnTo=${encodeURIComponent(
				`/dashboard/teams/${teamSlug}`,
			)}`,
		)
	}

	// Check team membership using the new function
	const { hasAccess, session: teamSession } = await hasTeamMembership(team.id)

	// If user doesn't have access, show error message
	if (!hasAccess) {
		return (
			<div className="container mx-auto px-5 py-12">
				<Alert
					color="danger"
					title="Access Denied"
					description={`You don't have permission to access team "${team.name}". Please contact the team owner to request access.`}
					className="mb-6"
				/>
				<Button asChild className="mt-4">
					<Link href="/settings/teams">Return to Teams</Link>
				</Button>
			</div>
		)
	}

	// Check permissions
	const canInviteMembers = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.INVITE_MEMBERS,
	)
	const canRemoveMembers = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.REMOVE_MEMBERS,
	)

	// Fetch team members
	const teamMembers = await getTeamMembers(team.id)

	return (
		<div className="container mx-auto px-5 pb-12">
			<div className="flex justify-between items-start mb-8">
				<div className="flex items-center gap-4">
					<div className="space-y-2">
						<h1 className="text-4xl font-bold mt-4">{team.name}</h1>
						{team.description && (
							<p className="text-muted-foreground mt-2">{team.description}</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-4">
					{canInviteMembers && !team.isPersonalTeam && (
						<InviteMemberModal
							teamId={team.id}
							trigger={<Button>Invite Members</Button>}
						/>
					)}

					{team.avatarUrl ? (
						<div className="h-16 w-16 border-2 border-primary overflow-hidden shadow-[2px_2px_0px_0px] shadow-primary">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={team.avatarUrl || ""}
								alt={`${team.name} avatar`}
								className="h-full w-full object-cover"
							/>
						</div>
					) : null}
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Quick stats */}
				<div className="col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Team Credits</CardTitle>
						</CardHeader>
						<CardContent>
							<span className="text-sm font-mono font-medium text-muted-foreground">
								Team Credits
							</span>
							<span className="text-2xl font-mono font-bold">
								{team.creditBalance || 0}
							</span>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Your Role</CardTitle>
						</CardHeader>
						<CardContent>
							<span className="text-2xl font-mono font-bold capitalize">
								{teamSession?.teams?.find((t) => t.id === team.id)?.role.name ||
									"Member"}
							</span>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Created</CardTitle>
						</CardHeader>
						<CardContent>
							{new Date(team.createdAt).toLocaleDateString()}
						</CardContent>
					</Card>
				</div>

				{/* Team Members and Invitations */}
				<div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
					{canInviteMembers && !team.isPersonalTeam && (
						<TeamInvitations teamId={team.id} />
					)}
				</div>

				{/* Team Members Table */}
				<Card className="col-span-3">
					<CardHeader>
						<CardTitle>Team Members</CardTitle>
					</CardHeader>
					<CardContent className="hidden md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Member</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
									<TableHead>Status</TableHead>
									{canRemoveMembers && (
										<TableHead className="text-right">Action</TableHead>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{teamMembers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={canRemoveMembers ? 6 : 5}
											className="text-center py-6 text-muted-foreground"
										>
											No members found
										</TableCell>
									</TableRow>
								) : (
									teamMembers.map((member) => (
										<TableRow key={member.id}>
											<TableCell className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarImage
														src={member.user.avatar || ""}
														alt={`${member.user.firstName || ""} ${
															member.user.lastName || ""
														}`}
													/>
													<AvatarFallback>
														{member.user.firstName?.[0]}
														{member.user.lastName?.[0]}
													</AvatarFallback>
												</Avatar>
												<span>
													{member.user.firstName} {member.user.lastName}
												</span>
											</TableCell>
											<TableCell>{member.user.email}</TableCell>
											<TableCell className="capitalize">
												{member.roleName}
											</TableCell>
											<TableCell>
												{/* {member.joinedAt !== null
													? formatDate(member.joinedAt)
													: "Not joined"} */}
											</TableCell>
											<TableCell>
												{member.isActive ? (
													<span className="text-green-600 dark:text-green-400">
														Active
													</span>
												) : (
													<span className="text-red-600 dark:text-red-400">
														Inactive
													</span>
												)}
											</TableCell>
											{canRemoveMembers && (
												<TableCell className="text-right">
													<RemoveMemberButton
														teamId={team.id}
														userId={member.userId}
														memberName={
															`${member.user.firstName || ""} ${
																member.user.lastName || ""
															}`.trim() ||
															member.user.email ||
															""
														}
														isDisabled={
															member.isSystemRole && member.roleId === "owner"
														}
														tooltipText="Team owners cannot be removed"
													/>
												</TableCell>
											)}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Card view for mobile */}
				<div className="md:hidden">
					{teamMembers.length === 0 ? (
						<div className="text-center py-6 text-muted-foreground">
							No members found
						</div>
					) : (
						teamMembers.map((member) => (
							<TeamMemberCard
								key={member.id}
								{...member}
								canRemoveMembers={canRemoveMembers}
								teamId={team.id}
							/>
						))
					)}
				</div>

				{/* Team Entitlements */}
				<div className="col-span-3">
					<h2 className="text-2xl font-bold mb-4">Plan & Entitlements</h2>
					<TeamEntitlements teamId={team.id} />
				</div>
			</div>
		</div>
	)
}
