/**
 * Competition Broadcasts Route
 *
 * Organizer page for sending one-way broadcast messages to athletes.
 * Supports audience filtering by division and delivery tracking.
 */
// @lat: [[organizer-dashboard#Broadcasts]]

import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Megaphone, Plus, Send, Users } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
	listBroadcastsFn,
	previewAudienceFn,
	sendBroadcastFn,
} from "@/server-fns/broadcast-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/broadcasts",
)({
	staleTime: 10_000,
	component: BroadcastsPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		const [{ broadcasts }, divisionsResult] = await Promise.all([
			listBroadcastsFn({ data: { competitionId: params.competitionId } }),
			getCompetitionDivisionsWithCountsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
		])

		const divisions = (divisionsResult.divisions ?? []).map(
			(d: { id: string; label: string }) => ({
				id: d.id,
				name: d.label,
			}),
		)

		return { broadcasts, divisions }
	},
})

function BroadcastsPage() {
	const { broadcasts, divisions } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const router = useRouter()
	const [isComposing, setIsComposing] = useState(false)

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1>
					<p className="text-muted-foreground">
						Send announcements to your registered athletes
					</p>
				</div>
				{!isComposing && (
					<Button onClick={() => setIsComposing(true)}>
						<Plus className="mr-2 h-4 w-4" />
						New Broadcast
					</Button>
				)}
			</div>

			{isComposing && (
				<ComposeCard
					competitionId={competition.id}
					divisions={divisions}
					onSent={() => {
						setIsComposing(false)
						router.invalidate()
					}}
					onCancel={() => setIsComposing(false)}
				/>
			)}

			{broadcasts.length === 0 && !isComposing ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-1">No broadcasts yet</h3>
						<p className="text-muted-foreground text-sm mb-4">
							Send your first broadcast to communicate with athletes
						</p>
						<Button onClick={() => setIsComposing(true)}>
							<Plus className="mr-2 h-4 w-4" />
							New Broadcast
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{broadcasts.map((broadcast) => (
						<Card key={broadcast.id}>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">
										{broadcast.title}
									</CardTitle>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="gap-1">
											<Users className="h-3 w-3" />
											{broadcast.recipientCount}
										</Badge>
										{broadcast.deliveryStats.failed > 0 ? (
											<Badge variant="destructive">
												{broadcast.deliveryStats.failed} failed
											</Badge>
										) : (
											<Badge variant="secondary">
												{broadcast.deliveryStats.sent} delivered
											</Badge>
										)}
									</div>
								</div>
								<CardDescription>
									{broadcast.sentAt
										? new Date(broadcast.sentAt).toLocaleDateString(
												"en-US",
												{
													month: "short",
													day: "numeric",
													year: "numeric",
													hour: "numeric",
													minute: "2-digit",
												},
											)
										: "Draft"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{broadcast.body}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}

// ============================================================================
// Compose Card
// ============================================================================

interface Division {
	id: string
	name: string
}

type AudienceFilterType =
	| "all"
	| "division"
	| "public"
	| "volunteers"
	| "volunteer_role"

const VOLUNTEER_ROLES = [
	{ value: "judge", label: "Judge" },
	{ value: "head_judge", label: "Head Judge" },
	{ value: "scorekeeper", label: "Scorekeeper" },
	{ value: "check_in", label: "Check-In" },
	{ value: "medical", label: "Medical" },
	{ value: "emcee", label: "Emcee" },
	{ value: "floor_manager", label: "Floor Manager" },
	{ value: "equipment", label: "Equipment" },
	{ value: "equipment_team", label: "Equipment Team" },
	{ value: "media", label: "Media" },
	{ value: "athlete_control", label: "Athlete Control" },
	{ value: "staff", label: "Staff" },
	{ value: "general", label: "General" },
]

function ComposeCard({
	competitionId,
	divisions,
	onSent,
	onCancel,
}: {
	competitionId: string
	divisions: Division[]
	onSent: () => void
	onCancel: () => void
}) {
	const [title, setTitle] = useState("")
	const [body, setBody] = useState("")
	const [filterType, setFilterType] = useState<AudienceFilterType>("all")
	const [divisionId, setDivisionId] = useState<string>("")
	const [volunteerRole, setVolunteerRole] = useState<string>("")
	const [shouldSendEmail, setShouldSendEmail] = useState(true)
	const [audienceCount, setAudienceCount] = useState<number | null>(null)
	const [isSending, setIsSending] = useState(false)
	const [isPreviewing, setIsPreviewing] = useState(false)

	const audienceFilter =
		filterType === "division" && divisionId
			? { type: "division" as const, divisionId }
			: filterType === "volunteer_role" && volunteerRole
				? { type: "volunteer_role" as const, volunteerRole }
				: { type: filterType as "all" | "public" | "volunteers" }

	// Auto-fetch recipient count when filter is complete
	const filterReady =
		filterType !== "division" || divisionId
			? filterType !== "volunteer_role" || volunteerRole
				? true
				: false
			: false

	useEffect(() => {
		if (!filterReady) {
			setAudienceCount(null)
			return
		}
		let cancelled = false
		setIsPreviewing(true)
		previewAudienceFn({
			data: { competitionId, audienceFilter },
		})
			.then((result) => {
				if (!cancelled) setAudienceCount(result.count)
			})
			.catch(() => {
				if (!cancelled) setAudienceCount(null)
			})
			.finally(() => {
				if (!cancelled) setIsPreviewing(false)
			})
		return () => {
			cancelled = true
		}
	}, [filterType, divisionId, volunteerRole, competitionId])

	const handleSend = async () => {
		if (!title.trim() || !body.trim()) {
			toast.error("Title and body are required")
			return
		}

		if (filterType === "division" && !divisionId) {
			toast.error("Please select a division")
			return
		}

		if (filterType === "volunteer_role" && !volunteerRole) {
			toast.error("Please select a volunteer role")
			return
		}

		setIsSending(true)
		try {
			const result = await sendBroadcastFn({
				data: {
					competitionId,
					title: title.trim(),
					body: body.trim(),
					audienceFilter,
					sendEmail: shouldSendEmail,
				},
			})
			toast.success(
				`Broadcast sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}`,
			)
			onSent()
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to send broadcast",
			)
		} finally {
			setIsSending(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>New Broadcast</CardTitle>
				<CardDescription>
					Compose a message to send to athletes, volunteers, or everyone via
					email and in-app notification
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						placeholder="e.g., Schedule Change for Saturday"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="body">Message</Label>
					<Textarea
						id="body"
						placeholder="Write your broadcast message..."
						rows={5}
						value={body}
						onChange={(e) => setBody(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label>Audience</Label>
					<div className="flex gap-3">
						<Select
							value={filterType}
							onValueChange={(v) => {
								setFilterType(v as AudienceFilterType)
								setDivisionId("")
								setVolunteerRole("")
								setAudienceCount(null)
							}}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="public">Everyone (Public)</SelectItem>
								<SelectItem value="all">All Athletes</SelectItem>
								<SelectItem value="division">Athletes by Division</SelectItem>
								<SelectItem value="volunteers">All Volunteers</SelectItem>
								<SelectItem value="volunteer_role">Volunteers by Role</SelectItem>
							</SelectContent>
						</Select>

						{filterType === "division" && (
							<Select
								value={divisionId}
								onValueChange={(v) => {
									setDivisionId(v)
									setAudienceCount(null)
								}}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Select division" />
								</SelectTrigger>
								<SelectContent>
									{divisions.map((div) => (
										<SelectItem key={div.id} value={div.id}>
											{div.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						{filterType === "volunteer_role" && (
							<Select
								value={volunteerRole}
								onValueChange={(v) => {
									setVolunteerRole(v)
									setAudienceCount(null)
								}}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{VOLUNTEER_ROLES.map((role) => (
										<SelectItem key={role.value} value={role.value}>
											{role.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
							<Users className="h-4 w-4" />
							{isPreviewing
								? "Counting..."
								: audienceCount !== null
									? `${audienceCount} recipient${audienceCount === 1 ? "" : "s"}`
									: ""}
						</span>
					</div>
				</div>

				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={shouldSendEmail}
						onChange={(e) => setShouldSendEmail(e.target.checked)}
						className="rounded border-border"
					/>
					Send email notification to recipients
				</label>

				<div className="flex justify-end gap-3 pt-4 border-t">
					<Button variant="outline" onClick={onCancel} disabled={isSending}>
						Cancel
					</Button>
					<Button
						onClick={handleSend}
						disabled={isSending || !title.trim() || !body.trim()}
					>
						<Send className="mr-2 h-4 w-4" />
						{isSending ? "Sending..." : "Send Broadcast"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
