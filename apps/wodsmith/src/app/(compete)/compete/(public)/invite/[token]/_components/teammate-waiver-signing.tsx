"use client"

import { useServerAction } from "@repo/zsa-react"
import { CheckCircle, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { acceptTeamInvitationAction } from "@/actions/team-actions"
import { signWaiverAction } from "@/actions/waivers"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Waiver } from "@/db/schemas/waivers"

type Props = {
	waivers: Waiver[]
	registrationId: string
	token: string
	competitionSlug?: string
	competitionId?: string
	teamName?: string
}

type WaiverSigningState = {
	waiverId: string
	agreed: boolean
	signed: boolean
}

/**
 * Component for displaying and signing waivers during teammate invite acceptance.
 * Teammate must sign all required waivers before accepting the team invitation.
 *
 * @example
 * ```tsx
 * <TeammateWaiverSigning
 *   waivers={competitionWaivers}
 *   registrationId={registration.id}
 *   token={inviteToken}
 *   competitionSlug="slug"
 *   teamName="Team Name"
 * />
 * ```
 */
export function TeammateWaiverSigning({
	waivers,
	registrationId,
	token,
	competitionSlug,
	competitionId,
	teamName,
}: Props) {
	const router = useRouter()
	const [waiverStates, setWaiverStates] = useState<WaiverSigningState[]>([])
	const [expandedWaivers, setExpandedWaivers] = useState<Set<string>>(new Set())

	// Initialize waiver states
	useEffect(() => {
		setWaiverStates(
			waivers.map((waiver) => ({
				waiverId: waiver.id,
				agreed: false,
				signed: false,
			})),
		)
		// Auto-expand first waiver
		if (waivers.length > 0 && waivers[0]) {
			setExpandedWaivers(new Set([waivers[0].id]))
		}
	}, [waivers])

	const { execute: signWaiver, isPending: isSigningWaiver } =
		useServerAction(signWaiverAction)

	const { execute: acceptInvite, isPending: isAcceptingInvite } =
		useServerAction(acceptTeamInvitationAction, {
			onSuccess: () => {
				toast.success("You've joined the team!")
				posthog.capture("competition_team_invite_accepted", {
					competition_slug: competitionSlug,
					competition_id: competitionId,
					team_name: teamName,
				})
				if (competitionSlug) {
					router.push(`/compete/${competitionSlug}`)
				} else {
					router.push("/compete")
				}
			},
			onError: ({ err }) => {
				toast.error(err?.message || "Failed to accept invitation")
				posthog.capture("competition_team_invite_accepted_failed", {
					competition_slug: competitionSlug,
					error_message: err?.message,
				})
			},
		})

	const toggleWaiverExpanded = (waiverId: string) => {
		setExpandedWaivers((prev) => {
			const next = new Set(prev)
			if (next.has(waiverId)) {
				next.delete(waiverId)
			} else {
				next.add(waiverId)
			}
			return next
		})
	}

	const handleAgreeChange = async (waiverId: string, agreed: boolean) => {
		// Update local state
		setWaiverStates((prev) =>
			prev.map((state) =>
				state.waiverId === waiverId ? { ...state, agreed } : state,
			),
		)

		// If checked, sign the waiver
		if (agreed) {
			try {
				// Get user's IP address (best effort)
				const ipAddress = await fetch("https://api.ipify.org?format=json")
					.then((res) => res.json() as Promise<{ ip: string }>)
					.then((data) => data.ip)
					.catch(() => "unknown")

				const result = await signWaiver({
					waiverId,
					registrationId,
					ipAddress,
				})

				if (result[0] && "success" in result[0] && result[0].success) {
					setWaiverStates((prev) =>
						prev.map((state) =>
							state.waiverId === waiverId ? { ...state, signed: true } : state,
						),
					)
					toast.success("Waiver signed")
				} else {
					// Signing failed, uncheck
					setWaiverStates((prev) =>
						prev.map((state) =>
							state.waiverId === waiverId ? { ...state, agreed: false } : state,
						),
					)
					toast.error("Failed to sign waiver")
				}
			} catch (error) {
				console.error("Failed to sign waiver:", error)
				// Signing failed, uncheck
				setWaiverStates((prev) =>
					prev.map((state) =>
						state.waiverId === waiverId ? { ...state, agreed: false } : state,
					),
				)
				toast.error("Failed to sign waiver")
			}
		}
	}

	const handleJoinTeam = async () => {
		await acceptInvite({ token })
	}

	// Check if all required waivers are signed
	const allRequiredSigned = waivers.every((waiver) => {
		if (!waiver.required) return true
		const state = waiverStates.find((s) => s.waiverId === waiver.id)
		return state?.signed === true
	})

	const isPending = isSigningWaiver || isAcceptingInvite

	return (
		<div className="space-y-6">
			{/* Waivers Section */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<FileText className="w-5 h-5 text-muted-foreground" />
					<h3 className="font-semibold">Required Waivers</h3>
				</div>

				{waivers.map((waiver, index) => {
					const state = waiverStates.find((s) => s.waiverId === waiver.id)
					const isExpanded = expandedWaivers.has(waiver.id)

					return (
						<div
							key={waiver.id}
							className="border rounded-lg overflow-hidden bg-card"
						>
							{/* Waiver Header */}
							<button
								type="button"
								onClick={() => toggleWaiverExpanded(waiver.id)}
								className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
							>
								<div className="flex items-center gap-3">
									<span className="text-sm font-medium text-muted-foreground">
										{index + 1}.
									</span>
									<div>
										<p className="font-medium">{waiver.title}</p>
										{waiver.required && (
											<p className="text-xs text-muted-foreground">Required</p>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{state?.signed && (
										<CheckCircle className="w-5 h-5 text-green-500" />
									)}
									<span className="text-sm text-muted-foreground">
										{isExpanded ? "Hide" : "Read"}
									</span>
								</div>
							</button>

							{/* Waiver Content (Expanded) */}
							{isExpanded && (
								<div className="border-t p-4 space-y-4">
									<WaiverViewer
										content={
											typeof waiver.content === "string"
												? JSON.parse(waiver.content)
												: waiver.content
										}
										className="max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-muted/30"
									/>

									{/* Agreement Checkbox */}
									<div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
										<Checkbox
											id={`agree-${waiver.id}`}
											checked={state?.agreed || false}
											onCheckedChange={(checked) =>
												handleAgreeChange(waiver.id, checked === true)
											}
											disabled={state?.signed || isPending}
										/>
										<Label
											htmlFor={`agree-${waiver.id}`}
											className="text-sm leading-relaxed cursor-pointer"
										>
											I have read and agree to the terms of this waiver
											{waiver.required && " (Required)"}
										</Label>
									</div>
								</div>
							)}
						</div>
					)
				})}
			</div>

			{/* Join Team Button */}
			<Button
				onClick={handleJoinTeam}
				disabled={!allRequiredSigned || isPending}
				className="w-full"
				size="lg"
			>
				{isPending ? (
					"Processing..."
				) : (
					<>
						<CheckCircle className="w-4 h-4 mr-2" />
						{allRequiredSigned ? "Join Team" : "Sign All Waivers to Continue"}
					</>
				)}
			</Button>

			{!allRequiredSigned && (
				<p className="text-sm text-center text-muted-foreground">
					Please read and sign all required waivers above to join the team
				</p>
			)}
		</div>
	)
}
