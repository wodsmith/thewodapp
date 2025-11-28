"use client"

import { Bell, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface PendingInvite {
	id: string
	token: string
	team: {
		id: string | undefined
		name: string | undefined
	}
	competitionId: string | null
	competitionSlug: string | null
	invitedBy: {
		firstName: string | null | undefined
		lastName: string | null | undefined
	}
}

interface PendingTeamInvitesProps {
	invitations: PendingInvite[]
	/** If provided, only show invites for this competition */
	competitionId?: string
	/** Variant: 'card' shows as a card, 'inline' shows as a simple list */
	variant?: "card" | "inline"
}

export function PendingTeamInvites({
	invitations,
	competitionId,
	variant = "card",
}: PendingTeamInvitesProps) {
	// Filter by competition if provided
	const filteredInvites = competitionId
		? invitations.filter((inv) => inv.competitionId === competitionId)
		: invitations

	if (filteredInvites.length === 0) {
		return null
	}

	if (variant === "inline") {
		return (
			<div className="space-y-2">
				{filteredInvites.map((invitation) => (
					<Link
						key={invitation.id}
						href={`/compete/invite/${invitation.token}`}
						className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
					>
						<Bell className="h-4 w-4 text-amber-600" />
						<div className="flex-1">
							<p className="font-medium text-sm">Team Invite</p>
							<p className="text-muted-foreground text-xs">
								{invitation.team.name}
								{invitation.invitedBy.firstName && (
									<> from {invitation.invitedBy.firstName}</>
								)}
							</p>
						</div>
						<Button size="sm" variant="outline" className="h-7">
							View
						</Button>
					</Link>
				))}
			</div>
		)
	}

	return (
		<Card className="border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<Bell className="h-4 w-4 text-amber-600" />
					Pending Team {filteredInvites.length === 1 ? "Invite" : "Invites"}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{filteredInvites.map((invitation) => (
					<div
						key={invitation.id}
						className="flex items-center justify-between gap-2"
					>
						<div className="flex items-center gap-2 min-w-0">
							<Users className="h-4 w-4 text-muted-foreground shrink-0" />
							<div className="min-w-0">
								<p className="font-medium text-sm truncate">
									{invitation.team.name}
								</p>
								{invitation.invitedBy.firstName && (
									<p className="text-muted-foreground text-xs truncate">
										Invited by {invitation.invitedBy.firstName}{" "}
										{invitation.invitedBy.lastName}
									</p>
								)}
							</div>
						</div>
						<Button asChild size="sm" variant="default" className="shrink-0">
							<Link href={`/compete/invite/${invitation.token}`}>
								Accept
							</Link>
						</Button>
					</div>
				))}
			</CardContent>
		</Card>
	)
}
