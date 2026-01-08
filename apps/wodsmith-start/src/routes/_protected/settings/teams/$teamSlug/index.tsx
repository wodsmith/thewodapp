import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Mail, Trash2, UserMinus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { SYSTEM_ROLES_ENUM } from "@/db/schemas/teams"
import {
	cancelInvitationFn,
	getTeamBySlugFn,
	getTeamInvitationsFn,
	getTeamMembersFn,
	inviteUserFn,
	removeTeamMemberFn,
	type TeamInvitationInfo,
	type TeamMemberInfo,
	updateMemberRoleFn,
} from "@/server-fns/team-settings-fns"

export const Route = createFileRoute("/_protected/settings/teams/$teamSlug/")({
	component: TeamDetailPage,
	loader: async ({ params }) => {
		const teamResult = await getTeamBySlugFn({
			data: { slug: params.teamSlug },
		})

		if (!teamResult.success || !teamResult.data) {
			return {
				team: null,
				members: [] as TeamMemberInfo[],
				invitations: [] as TeamInvitationInfo[],
			}
		}

		const team = teamResult.data

		// Fetch members and invitations in parallel
		const [membersResult, invitationsResult] = await Promise.all([
			getTeamMembersFn({ data: { teamId: team.id } }),
			getTeamInvitationsFn({ data: { teamId: team.id } }).catch(() => ({
				success: false,
				data: [] as TeamInvitationInfo[],
			})),
		])

		return {
			team,
			members: membersResult.success ? membersResult.data : [],
			invitations: invitationsResult.success ? invitationsResult.data : [],
		}
	},
})

function TeamDetailPage() {
	const { team, members, invitations } = Route.useLoaderData()
	const router = useRouter()

	if (!team) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3 mb-6">
					<Button variant="outline" size="icon" asChild>
						<Link to="/settings/teams">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1 className="text-2xl font-bold">Team Not Found</h1>
				</div>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-center">
							The team you're looking for doesn't exist or you don't have access
							to it.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	const handleRefresh = () => {
		router.invalidate()
	}

	return (
		<div className="space-y-6">
			{/* Header with back button */}
			<div className="flex items-center gap-3">
				<Button variant="outline" size="icon" asChild>
					<Link to="/settings/teams">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div>
					<h1 className="text-2xl font-bold">{team.name}</h1>
					{team.description && (
						<p className="text-muted-foreground">{team.description}</p>
					)}
				</div>
			</div>

			{/* Team Info Card */}
			<Card>
				<CardHeader>
					<CardTitle>Team Information</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label className="text-muted-foreground">Members</Label>
							<p className="text-lg font-semibold">{members.length}</p>
						</div>
						<div>
							<Label className="text-muted-foreground">Created</Label>
							<p className="text-lg font-semibold">
								{new Date(team.createdAt).toLocaleDateString()}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Invite Member Section */}
			{!team.isPersonalTeam && (
				<InviteMemberSection teamId={team.id} onSuccess={handleRefresh} />
			)}

			{/* Pending Invitations Section */}
			{!team.isPersonalTeam && invitations.length > 0 && (
				<InvitationsSection
					invitations={invitations}
					onCancelled={handleRefresh}
				/>
			)}

			{/* Team Members Section */}
			<TeamMembersSection
				members={members}
				teamId={team.id}
				isPersonalTeam={Boolean(team.isPersonalTeam)}
				onMemberUpdated={handleRefresh}
			/>
		</div>
	)
}

// ============================================================================
// Invite Member Section
// ============================================================================

interface InviteMemberSectionProps {
	teamId: string
	onSuccess: () => void
}

function InviteMemberSection({ teamId, onSuccess }: InviteMemberSectionProps) {
	const [email, setEmail] = useState("")
	const [roleId, setRoleId] = useState<string>(SYSTEM_ROLES_ENUM.MEMBER)
	const [isInviting, setIsInviting] = useState(false)

	const inviteUser = useServerFn(inviteUserFn)

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!email.trim()) {
			toast.error("Please enter an email address")
			return
		}

		setIsInviting(true)
		try {
			const result = await inviteUser({
				data: {
					teamId,
					email: email.trim(),
					roleId,
					isSystemRole: true,
				},
			})

			if (result.success) {
				if (result.data?.userJoined) {
					toast.success("User added to team!")
				} else {
					toast.success("Invitation sent!")
				}
				setEmail("")
				setRoleId(SYSTEM_ROLES_ENUM.MEMBER)
				onSuccess()
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to invite user"
			toast.error(message)
		} finally {
			setIsInviting(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Mail className="h-5 w-5" />
					Invite Member
				</CardTitle>
				<CardDescription>
					Invite someone to join your team. If they already have an account,
					they'll be added immediately.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={handleInvite}
					className="flex flex-col sm:flex-row gap-3"
				>
					<div className="flex-1">
						<Input
							type="email"
							placeholder="teammate@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={isInviting}
						/>
					</div>
					<Select
						value={roleId}
						onValueChange={setRoleId}
						disabled={isInviting}
					>
						<SelectTrigger className="w-full sm:w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={SYSTEM_ROLES_ENUM.ADMIN}>Admin</SelectItem>
							<SelectItem value={SYSTEM_ROLES_ENUM.MEMBER}>Member</SelectItem>
							<SelectItem value={SYSTEM_ROLES_ENUM.GUEST}>Guest</SelectItem>
						</SelectContent>
					</Select>
					<Button type="submit" disabled={isInviting}>
						{isInviting ? "Inviting..." : "Invite"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Invitations Section
// ============================================================================

interface InvitationsSectionProps {
	invitations: TeamInvitationInfo[]
	onCancelled: () => void
}

function InvitationsSection({
	invitations,
	onCancelled,
}: InvitationsSectionProps) {
	const [cancellingId, setCancellingId] = useState<string | null>(null)
	const cancelInvitation = useServerFn(cancelInvitationFn)

	const handleCancelInvitation = async (invitationId: string) => {
		setCancellingId(invitationId)
		try {
			const result = await cancelInvitation({ data: { invitationId } })

			if (result.success) {
				toast.success("Invitation cancelled")
				onCancelled()
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to cancel invitation"
			toast.error(message)
		} finally {
			setCancellingId(null)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pending Invitations</CardTitle>
				<CardDescription>
					These users have been invited but haven't joined yet.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{invitations.map((invitation) => (
						<div
							key={invitation.id}
							className="flex items-center justify-between gap-4 px-3 py-2 rounded-md border bg-background"
						>
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{invitation.email}</p>
								<p className="text-sm text-muted-foreground">
									Invited as{" "}
									<span className="capitalize">{invitation.roleId}</span>
									{invitation.expiresAt && (
										<>
											{" "}
											&bull; Expires{" "}
											{new Date(invitation.expiresAt).toLocaleDateString()}
										</>
									)}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleCancelInvitation(invitation.id)}
								disabled={cancellingId === invitation.id}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Team Members Section
// ============================================================================

interface TeamMembersSectionProps {
	members: TeamMemberInfo[]
	teamId: string
	isPersonalTeam: boolean
	onMemberUpdated: () => void
}

function TeamMembersSection({
	members,
	teamId,
	isPersonalTeam,
	onMemberUpdated,
}: TeamMembersSectionProps) {
	const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
	const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

	const updateMemberRole = useServerFn(updateMemberRoleFn)
	const removeMember = useServerFn(removeTeamMemberFn)

	const handleRoleChange = async (userId: string, newRoleId: string) => {
		setUpdatingMemberId(userId)
		try {
			const result = await updateMemberRole({
				data: {
					teamId,
					userId,
					roleId: newRoleId,
					isSystemRole: true,
				},
			})

			if (result.success) {
				toast.success("Role updated")
				onMemberUpdated()
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update role"
			toast.error(message)
		} finally {
			setUpdatingMemberId(null)
		}
	}

	const handleRemoveMember = async (userId: string, memberName: string) => {
		if (
			!confirm(`Are you sure you want to remove ${memberName} from the team?`)
		) {
			return
		}

		setRemovingMemberId(userId)
		try {
			const result = await removeMember({ data: { teamId, userId } })

			if (result.success) {
				toast.success("Member removed")
				onMemberUpdated()
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to remove member"
			toast.error(message)
		} finally {
			setRemovingMemberId(null)
		}
	}

	const isOwner = (member: TeamMemberInfo) =>
		member.isSystemRole && member.roleId === SYSTEM_ROLES_ENUM.OWNER

	return (
		<Card>
			<CardHeader>
				<CardTitle>Team Members</CardTitle>
				<CardDescription>
					{members.length} member{members.length !== 1 ? "s" : ""} in this team
				</CardDescription>
			</CardHeader>
			<CardContent>
				{/* Desktop table view */}
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Member</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
								{!isPersonalTeam && (
									<TableHead className="text-right">Actions</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={isPersonalTeam ? 4 : 5}
										className="text-center py-6 text-muted-foreground"
									>
										No members found
									</TableCell>
								</TableRow>
							) : (
								members.map((member) => (
									<TableRow key={member.id}>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarImage
														src={member.user.avatar || ""}
														alt={`${member.user.firstName || ""} ${member.user.lastName || ""}`}
													/>
													<AvatarFallback>
														{member.user.firstName?.[0]}
														{member.user.lastName?.[0]}
													</AvatarFallback>
												</Avatar>
												<span>
													{member.user.firstName} {member.user.lastName}
												</span>
											</div>
										</TableCell>
										<TableCell>{member.user.email}</TableCell>
										<TableCell>
											{!isPersonalTeam && !isOwner(member) ? (
												<Select
													value={member.roleId}
													onValueChange={(value) =>
														handleRoleChange(member.userId, value)
													}
													disabled={updatingMemberId === member.userId}
												>
													<SelectTrigger className="w-28">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={SYSTEM_ROLES_ENUM.ADMIN}>
															Admin
														</SelectItem>
														<SelectItem value={SYSTEM_ROLES_ENUM.MEMBER}>
															Member
														</SelectItem>
														<SelectItem value={SYSTEM_ROLES_ENUM.GUEST}>
															Guest
														</SelectItem>
													</SelectContent>
												</Select>
											) : (
												<Badge variant="secondary" className="capitalize">
													{member.roleName}
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant={member.isActive ? "default" : "destructive"}
											>
												{member.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										{!isPersonalTeam && (
											<TableCell className="text-right">
												{!isOwner(member) && (
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															handleRemoveMember(
																member.userId,
																`${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() ||
																	member.user.email ||
																	"this member",
															)
														}
														disabled={removingMemberId === member.userId}
														title="Remove member"
													>
														<UserMinus className="h-4 w-4" />
													</Button>
												)}
											</TableCell>
										)}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{/* Mobile card view */}
				<div className="md:hidden space-y-3">
					{members.length === 0 ? (
						<p className="text-center py-6 text-muted-foreground">
							No members found
						</p>
					) : (
						members.map((member) => (
							<MemberCard
								key={member.id}
								member={member}
								teamId={teamId}
								isPersonalTeam={isPersonalTeam}
								isUpdating={updatingMemberId === member.userId}
								isRemoving={removingMemberId === member.userId}
								onRoleChange={(roleId) =>
									handleRoleChange(member.userId, roleId)
								}
								onRemove={() =>
									handleRemoveMember(
										member.userId,
										`${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() ||
											member.user.email ||
											"this member",
									)
								}
							/>
						))
					)}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Member Card (Mobile)
// ============================================================================

interface MemberCardProps {
	member: TeamMemberInfo
	teamId: string
	isPersonalTeam: boolean
	isUpdating: boolean
	isRemoving: boolean
	onRoleChange: (roleId: string) => void
	onRemove: () => void
}

function MemberCard({
	member,
	isPersonalTeam,
	isUpdating,
	isRemoving,
	onRoleChange,
	onRemove,
}: MemberCardProps) {
	const isOwner =
		member.isSystemRole && member.roleId === SYSTEM_ROLES_ENUM.OWNER

	return (
		<div className="border rounded-lg p-4 space-y-3">
			<div className="flex items-center gap-3">
				<Avatar className="h-10 w-10">
					<AvatarImage
						src={member.user.avatar || ""}
						alt={`${member.user.firstName || ""} ${member.user.lastName || ""}`}
					/>
					<AvatarFallback>
						{member.user.firstName?.[0]}
						{member.user.lastName?.[0]}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<p className="font-medium truncate">
						{member.user.firstName} {member.user.lastName}
					</p>
					<p className="text-sm text-muted-foreground truncate">
						{member.user.email}
					</p>
				</div>
				<Badge variant={member.isActive ? "default" : "destructive"}>
					{member.isActive ? "Active" : "Inactive"}
				</Badge>
			</div>

			<div className="flex items-center justify-between gap-3">
				{!isPersonalTeam && !isOwner ? (
					<Select
						value={member.roleId}
						onValueChange={onRoleChange}
						disabled={isUpdating}
					>
						<SelectTrigger className="w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={SYSTEM_ROLES_ENUM.ADMIN}>Admin</SelectItem>
							<SelectItem value={SYSTEM_ROLES_ENUM.MEMBER}>Member</SelectItem>
							<SelectItem value={SYSTEM_ROLES_ENUM.GUEST}>Guest</SelectItem>
						</SelectContent>
					</Select>
				) : (
					<Badge variant="secondary" className="capitalize">
						{member.roleName}
					</Badge>
				)}

				{!isPersonalTeam && !isOwner && (
					<Button
						variant="destructive"
						size="sm"
						onClick={onRemove}
						disabled={isRemoving}
					>
						<Trash2 className="h-4 w-4 mr-1" />
						Remove
					</Button>
				)}
			</div>
		</div>
	)
}
