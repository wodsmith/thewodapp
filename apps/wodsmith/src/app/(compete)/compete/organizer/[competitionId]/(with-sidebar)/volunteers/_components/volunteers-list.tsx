"use client"

import { UserPlus } from "lucide-react"
import { useState } from "react"

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
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { User } from "@/db/schema"

import { InviteVolunteerDialog } from "./invite-volunteer-dialog"
import { VolunteerRow } from "./volunteer-row"

interface VolunteerWithAccess {
	id: string
	userId: string
	metadata: string | null
	user: User | null
	hasScoreAccess: boolean
}

interface VolunteersListProps {
	competitionId: string
	competitionTeamId: string
	organizingTeamId: string
	volunteers: VolunteerWithAccess[]
}

/**
 * Client component for displaying and managing competition volunteers
 */

export function VolunteersList({
	competitionId,
	competitionTeamId,
	organizingTeamId,
	volunteers,
}: VolunteersListProps) {
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

	if (volunteers.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>No Volunteers</CardTitle>
					<CardDescription>
						No volunteers have been added to this competition yet.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={() => setInviteDialogOpen(true)}>
						<UserPlus className="mr-2 h-4 w-4" />
						Invite Volunteer
					</Button>
					<InviteVolunteerDialog
						competitionTeamId={competitionTeamId}
						open={inviteDialogOpen}
						onOpenChange={setInviteDialogOpen}
					/>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Actions */}
			<div className="flex items-center justify-end">
				<Button onClick={() => setInviteDialogOpen(true)}>
					<UserPlus className="mr-2 h-4 w-4" />
					Invite Volunteer
				</Button>
				<InviteVolunteerDialog
					competitionTeamId={competitionTeamId}
					open={inviteDialogOpen}
					onOpenChange={setInviteDialogOpen}
				/>
			</div>

			{/* Volunteers Table */}
			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role Types</TableHead>
								<TableHead>Score Access</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{volunteers.map((volunteer) => (
								<VolunteerRow
									key={volunteer.id}
									volunteer={volunteer}
									competitionId={competitionId}
									competitionTeamId={competitionTeamId}
									organizingTeamId={organizingTeamId}
								/>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}
