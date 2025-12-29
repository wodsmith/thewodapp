import { Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import type { DirectVolunteerInvite } from "@/server-fns/volunteer-fns"
import { formatDate } from "@/utils/format-date-client"

type VolunteerRoleType =
	| "judge"
	| "head_judge"
	| "scorekeeper"
	| "emcee"
	| "floor_manager"
	| "media"
	| "general"

const ROLE_TYPE_LABELS: Record<VolunteerRoleType, string> = {
	judge: "Judge",
	head_judge: "Head Judge",
	scorekeeper: "Scorekeeper",
	emcee: "Emcee",
	floor_manager: "Floor Manager",
	media: "Media",
	general: "General",
}

interface InvitedVolunteersListProps {
	invites: DirectVolunteerInvite[]
}

export function InvitedVolunteersList({ invites }: InvitedVolunteersListProps) {
	const [copiedToken, setCopiedToken] = useState<string | null>(null)

	const copyInviteLink = async (token: string) => {
		if (typeof window === "undefined") return

		const inviteUrl = `${window.location.origin}/compete/invite/${token}`

		try {
			await navigator.clipboard.writeText(inviteUrl)
			setCopiedToken(token)
			toast.success("Invite link copied to clipboard")
			setTimeout(() => setCopiedToken(null), 2000)
		} catch {
			toast.error("Failed to copy link")
		}
	}

	const formatRoleTypes = (roleTypes: string[]): string => {
		if (roleTypes.length === 0) return "—"

		return roleTypes
			.map((roleType) => {
				const typedRole = roleType as VolunteerRoleType
				return ROLE_TYPE_LABELS[typedRole] || roleType
			})
			.join(", ")
	}

	const getStatusBadgeVariant = (
		status: "pending" | "accepted" | "expired",
	): "default" | "secondary" | "destructive" => {
		switch (status) {
			case "pending":
				return "secondary"
			case "accepted":
				return "default"
			case "expired":
				return "destructive"
		}
	}

	if (invites.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>No Direct Invitations</CardTitle>
					<CardDescription>
						No direct volunteer invitations have been sent yet.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Invited Volunteers</CardTitle>
				<CardDescription>
					Direct invitations sent to volunteers ({invites.length})
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Roles</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Date</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invites.map((invite) => (
							<TableRow key={invite.id}>
								<TableCell className="font-medium">{invite.email}</TableCell>
								<TableCell>{formatRoleTypes(invite.roleTypes)}</TableCell>
								<TableCell>
									<Badge variant={getStatusBadgeVariant(invite.status)}>
										{invite.status}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(invite.createdAt)}
								</TableCell>
								<TableCell className="text-right">
									<Button
										size="sm"
										variant="outline"
										onClick={() => copyInviteLink(invite.token)}
										disabled={copiedToken === invite.token}
									>
										<Copy className="mr-2 h-4 w-4" />
										{copiedToken === invite.token ? "Copied!" : "Copy Link"}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}
