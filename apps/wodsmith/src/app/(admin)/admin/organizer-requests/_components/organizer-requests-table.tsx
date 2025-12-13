"use client"

import { useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { format, formatDistanceToNow } from "date-fns"
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
import { Badge } from "@/components/ui/badge"
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

	const pendingRequests = requests.filter((r) => r.status === "pending")
	const processedRequests = requests.filter((r) => r.status !== "pending")

	const { execute: approve, isPending: isApproving } = useServerAction(
		approveOrganizerRequestAction,
		{
			onSuccess: ({ data }) => {
				toast.success("Request approved successfully")
				// Update local state with data from server response for complete info
				if (data?.data) {
					setRequests((prev) =>
						prev.map((r) =>
							r.id === selectedRequest?.id
								? {
										...r,
										status: data.data.status,
										reviewedAt: data.data.reviewedAt,
										reviewedBy: data.data.reviewedBy,
										adminNotes: data.data.adminNotes,
									}
								: r,
						),
					)
				}
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
			onSuccess: ({ data }) => {
				toast.success("Request rejected")
				// Update local state with data from server response for complete info
				if (data?.data) {
					setRequests((prev) =>
						prev.map((r) =>
							r.id === selectedRequest?.id
								? {
										...r,
										status: data.data.status,
										reviewedAt: data.data.reviewedAt,
										reviewedBy: data.data.reviewedBy,
										adminNotes: data.data.adminNotes,
									}
								: r,
						),
					)
				}
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

	const getReviewerName = (request: OrganizerRequestWithDetails) => {
		if (!request.reviewer) return "Unknown"
		const { firstName, lastName } = request.reviewer
		if (firstName && lastName) return `${firstName} ${lastName}`
		if (firstName) return firstName
		return "Unknown"
	}

	return (
		<>
			{/* Pending Requests Section */}
			{pendingRequests.length > 0 ? (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">
						Pending Requests ({pendingRequests.length})
					</h2>
					{pendingRequests.map((request) => (
						<Card key={request.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div>
										<CardTitle>{request.team.name}</CardTitle>
										<CardDescription>
											Requested by{" "}
											{request.user.firstName && request.user.lastName
												? `${request.user.firstName} ${request.user.lastName}`
												: request.user.email}{" "}
											{formatDistanceToNow(request.createdAt, {
												addSuffix: true,
											})}
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
			) : (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<ClockIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-lg font-medium">No pending requests</p>
						<p className="text-sm text-muted-foreground">
							All organizer applications have been processed
						</p>
					</CardContent>
				</Card>
			)}

			{/* Processed Requests Section */}
			{processedRequests.length > 0 && (
				<div className="mt-8 space-y-2">
					<h2 className="text-lg font-semibold mb-3">
						Past Requests ({processedRequests.length})
					</h2>
					<div className="border rounded-lg divide-y">
						{processedRequests.map((request) => (
							<div
								key={request.id}
								className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50"
							>
								<div className="flex items-center gap-3 min-w-0">
									<Badge
										variant={
											request.status === "approved" ? "default" : "destructive"
										}
										className="shrink-0 text-xs"
									>
										{request.status === "approved" ? "Approved" : "Rejected"}
									</Badge>
									<span className="font-medium truncate">
										{request.team.name}
									</span>
								</div>
								<div className="flex items-center gap-4 text-muted-foreground shrink-0">
									<span className="hidden sm:inline">
										{getReviewerName(request)}
									</span>
									{request.reviewedAt && (
										<span className="tabular-nums">
											{format(request.reviewedAt, "MMM d, yyyy")}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

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
