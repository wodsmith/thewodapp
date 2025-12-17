"use client"

import { UserPlus } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
	status?: "pending" | "approved" | "rejected"
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
	const [filter, setFilter] = useState<"all" | "pending" | "approved">("all")

	// Parse status from metadata
	const getVolunteerStatus = (
		volunteer: VolunteerWithAccess,
	): "pending" | "approved" | "rejected" => {
		if (!volunteer.metadata) return "approved"
		try {
			const parsed = JSON.parse(volunteer.metadata) as {
				status?: "pending" | "approved" | "rejected"
			}
			return parsed.status || "approved"
		} catch {
			return "approved"
		}
	}

	// Separate volunteers by status
	const pendingVolunteers = volunteers.filter(
		(v) => getVolunteerStatus(v) === "pending",
	)
	const approvedVolunteers = volunteers.filter(
		(v) => getVolunteerStatus(v) === "approved",
	)

	// Filter volunteers based on selected filter
	const filteredVolunteers =
		filter === "all"
			? volunteers
			: filter === "pending"
				? pendingVolunteers
				: approvedVolunteers

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
						competitionId={competitionId}
						competitionTeamId={competitionTeamId}
						organizingTeamId={organizingTeamId}
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
					competitionId={competitionId}
					competitionTeamId={competitionTeamId}
					organizingTeamId={organizingTeamId}
					open={inviteDialogOpen}
					onOpenChange={setInviteDialogOpen}
				/>
			</div>

			{/* Volunteers Table with Tabs */}
			<Tabs
				defaultValue="all"
				onValueChange={(v) => setFilter(v as typeof filter)}
			>
				<TabsList>
					<TabsTrigger value="all">
						All
						<Badge variant="secondary" className="ml-2">
							{volunteers.length}
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="pending">
						Pending
						{pendingVolunteers.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{pendingVolunteers.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="approved">
						Approved
						<Badge variant="secondary" className="ml-2">
							{approvedVolunteers.length}
						</Badge>
					</TabsTrigger>
				</TabsList>

				<TabsContent value={filter} className="mt-4">
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
									{filteredVolunteers.map((volunteer) => (
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
				</TabsContent>
			</Tabs>
		</div>
	)
}
