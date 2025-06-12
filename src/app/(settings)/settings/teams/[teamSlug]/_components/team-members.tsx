"use client"
import { RemoveMemberButton } from "@/components/teams/remove-member-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/utils/format-date-client"
import React from "react"

interface TeamMemberListItem {
	id: string
	userId: string
	roleId: string
	roleName: string
	isSystemRole: boolean
	isActive: boolean
	joinedAt: Date | null
	user: {
		id: string
		firstName: string | null
		lastName: string | null
		email: string | null
		avatar: string | null
	}
}

interface TeamMembersProps {
	teamMembers: TeamMemberListItem[]
}

export function TeamMembers({ teamMembers }: TeamMembersProps) {
	if (!teamMembers?.length) return <div>No team members found.</div>

	return (
		<div>
			<h3>Team Members</h3>
			<ul>
				{teamMembers.map((member) => (
					<li key={member.id}>
						{member.user.firstName} {member.user.lastName} ({member.user.email})
					</li>
				))}
			</ul>
		</div>
	)
}

interface TeamMemberCardProps extends TeamMemberListItem {
	canRemoveMembers: boolean
	teamId: string
}

export function TeamMemberCard({
	user,
	roleName,
	joinedAt,
	isActive,
	isSystemRole,
	roleId,
	userId,
	canRemoveMembers,
	teamId,
}: TeamMemberCardProps) {
	const email = user.email || ""
	return (
		<Card className="mb-4 md:hidden">
			<CardContent className="flex flex-col gap-3 p-4">
				<div className="flex items-center gap-3">
					<Avatar className="h-10 w-10">
						<AvatarImage
							src={user.avatar || ""}
							alt={`${user.firstName || ""} ${user.lastName || ""}`}
						/>
						<AvatarFallback>
							{user.firstName?.[0]}
							{user.lastName?.[0]}
						</AvatarFallback>
					</Avatar>
					<div>
						<div className="font-semibold">
							{user.firstName} {user.lastName}
						</div>
						<div className="text-xs text-muted-foreground">{email}</div>
					</div>
				</div>
				<div className="flex flex-wrap gap-2 text-sm">
					<span className="capitalize font-medium">{roleName}</span>
					<span>•</span>
					<span>{joinedAt ? formatDate(joinedAt) : "Not joined"}</span>
					<span>•</span>
					<span
						className={
							isActive
								? "text-green-600 dark:text-green-400"
								: "text-red-600 dark:text-red-400"
						}
					>
						{isActive ? "Active" : "Inactive"}
					</span>
				</div>
				{canRemoveMembers && (
					<div className="flex justify-end">
						<RemoveMemberButton
							teamId={teamId}
							userId={userId}
							memberName={
								`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
								email ||
								""
							}
							isDisabled={isSystemRole && roleId === "owner"}
							tooltipText="Team owners cannot be removed"
						/>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
