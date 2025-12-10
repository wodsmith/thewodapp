"use client"

import { useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
	CheckCircleIcon,
	XCircleIcon,
	ClockIcon,
} from "@heroicons/react/24/outline"
import {
	approveOrganizerRequestAction,
	rejectOrganizerRequestAction,
} from "@/app/(admin)/admin/_actions/organizer-admin-actions"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { OrganizerRequestWithDetails } from "@/server/organizer-onboarding"

interface OrganizerRequestsTableProps {
	requests: OrganizerRequestWithDetails[]
}

export function OrganizerRequestsTable({
	requests: initialRequests,
}: OrganizerRequestsTableProps) {
	const [requests, setRequests] =
		useState<OrganizerRequestWithDetails[]>(initialRequests)
	const [selectedRequest, setSelectedRequest] =
		useState<OrganizerRequestWithDetails | null>(null)
	const [dialogType, setDialogType] = useState<"approve" | "reject" | null>(
		null,
	)
	const [adminNotes, setAdminNotes] = useState("")

	const { execute: approve, isPending: isApproving } = useServerAction(
		approveOrganizerRequestAction,
		{
			onSuccess: () => {
				toast.success("Request approved successfully")
				setRequests((prev) =>
					prev.filter((r) => r.id !== selectedRequest?.id),
				)
				closeDialog()
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to approve request")
			},
		},
	)

	const { execute: reject, isPending: isRejecting } = useServerAction(
		rejectOrganizerRequestAction,
		{
			onSuccess: () => {
				toast.success("Request rejected")
				setRequests((prev) =>
					prev.filter((r) => r.id !== selectedRequest?.id),
				)
				closeDialog()
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to reject request")
			},
		},
	)

	const openApproveDialog = (request: OrganizerRequestWithDetails) => {
		setSelectedRequest(request)
		setDialogType("approve")
		setAdminNotes("")
	}

	const openRejectDialog = (request: OrganizerRequestWithDetails) => {
		setSelectedRequest(request)
		setDialogType("reject")
		setAdminNotes("")
	}

	const closeDialog = () => {
		setSelectedRequest(null)
		setDialogType(null)
		setAdminNotes("")
	}

	const handleApprove = () => {
		if (!selectedRequest) return
		approve({
			requestId: selectedRequest.id,
			adminNotes: adminNotes || undefined,
		})
	}

	const handleReject = () => {
		if (!selectedRequest) return
		reject({
			requestId: selectedRequest.id,
			adminNotes: adminNotes || undefined,
			revokeFeature: false,
		})
	}

	const isPending = isApproving || isRejecting

	if (requests.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<ClockIcon className="h-12 w-12 text-muted-foreground/50" />
					<p className="mt-4 text-lg font-medium">No pending requests</p>
					<p className="text-sm text-muted-foreground">
						All organizer applications have been processed
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<>
			<div className="space-y-4">
				{requests.map((request) => (
					<Card key={request.id}>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div>
									<CardTitle>{request.team.name}</CardTitle>
							<CardDescription>
								Requested by {request.user.firstName && request.user.lastName 
									? `${request.user.firstName} ${request.user.lastName}` 
									: request.user.email}{" "}
								{formatDistanceToNow(request.createdAt, { addSuffix: true })}
							</CardDescription>
								</div>
								<div className="flex gap-2">
									<Button
										size="sm"
										onClick={() => openApproveDialog(request)}
									>
										<CheckCircleIcon className="mr-1.5 h-4 w-4" />
										Approve
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => openRejectDialog(request)}
									>
										<XCircleIcon className="mr-1.5 h-4 w-4" />
										Reject
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div>
								<p className="text-sm font-medium text-muted-foreground mb-1">
									Reason for organizing
								</p>
								<p className="text-sm">{request.reason}</p>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Approve Dialog */}
			<Dialog
				open={dialogType === "approve"}
				onOpenChange={(open) => !open && closeDialog()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Approve Organizer Request</DialogTitle>
						<DialogDescription>
							Approving will allow {selectedRequest?.team.name} to publish
							public competitions.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="approve-notes">Notes (optional)</Label>
							<Textarea
								id="approve-notes"
								placeholder="Add any notes for this approval..."
								value={adminNotes}
								onChange={(e) => setAdminNotes(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialog} disabled={isPending}>
							Cancel
						</Button>
						<Button onClick={handleApprove} disabled={isPending}>
							{isApproving ? "Approving..." : "Approve"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject Dialog */}
			<Dialog
				open={dialogType === "reject"}
				onOpenChange={(open) => !open && closeDialog()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Organizer Request</DialogTitle>
						<DialogDescription>
							Are you sure you want to reject the request from{" "}
							{selectedRequest?.team.name}?
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="reject-notes">Reason for rejection</Label>
							<Textarea
								id="reject-notes"
								placeholder="Explain why this request is being rejected..."
								value={adminNotes}
								onChange={(e) => setAdminNotes(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialog} disabled={isPending}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleReject}
							disabled={isPending}
						>
							{isRejecting ? "Rejecting..." : "Reject"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
