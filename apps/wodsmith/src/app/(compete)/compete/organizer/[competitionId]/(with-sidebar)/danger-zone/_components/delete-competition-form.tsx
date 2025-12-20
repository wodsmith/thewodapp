"use client"

import { useServerAction } from "@repo/zsa-react"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useState } from "react"
import { toast } from "sonner"
import { deleteCompetitionAction } from "@/actions/competition-actions"
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

interface DeleteCompetitionFormProps {
	competitionId: string
	competitionName: string
	organizingTeamId: string
	registrationCount: number
}

export function DeleteCompetitionForm({
	competitionId,
	competitionName,
	organizingTeamId,
	registrationCount,
}: DeleteCompetitionFormProps) {
	const router = useRouter()
	const [confirmText, setConfirmText] = useState("")

	const { execute: deleteCompetition, isPending: isDeleting } = useServerAction(
		deleteCompetitionAction,
		{
			onSuccess: () => {
				toast.success("Competition deleted successfully")
				posthog.capture("competition_deleted", {
					competition_id: competitionId,
					competition_name: competitionName,
					registration_count: registrationCount,
				})
				router.push("/compete/organizer")
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete competition")
				posthog.capture("competition_deleted_failed", {
					competition_id: competitionId,
					error_message: err.message,
				})
			},
		},
	)

	const isConfirmed = confirmText === competitionName

	const handleDelete = () => {
		if (!isConfirmed) return
		deleteCompetition({ competitionId, organizingTeamId })
	}

	return (
		<Card className="border-destructive">
			<CardHeader>
				<CardTitle className="text-destructive flex items-center gap-2">
					<Trash2 className="h-5 w-5" />
					Delete Competition
				</CardTitle>
				<CardDescription>
					Permanently delete this competition and all associated data
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-md bg-destructive/10 p-4 text-sm">
					<p className="font-medium text-destructive mb-2">
						This action cannot be undone.
					</p>
					<p className="text-muted-foreground">
						Deleting this competition will permanently remove:
					</p>
					<ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
						<li>All competition details and settings</li>
						<li>All division configurations</li>
						{registrationCount > 0 && (
							<li className="font-medium text-destructive">
								{registrationCount} athlete registration
								{registrationCount !== 1 ? "s" : ""}
							</li>
						)}
						<li>All associated payment records</li>
					</ul>
				</div>

				<div className="space-y-2">
					<Label htmlFor="confirm-name">
						Type{" "}
						<span className="font-mono font-semibold">{competitionName}</span>{" "}
						to confirm
					</Label>
					<Input
						id="confirm-name"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder="Enter competition name"
						className="font-mono"
						disabled={isDeleting}
					/>
				</div>

				<Button
					variant="destructive"
					onClick={handleDelete}
					disabled={!isConfirmed || isDeleting}
					className="w-full"
				>
					{isDeleting ? "Deleting..." : "Delete Competition Permanently"}
				</Button>
			</CardContent>
		</Card>
	)
}
