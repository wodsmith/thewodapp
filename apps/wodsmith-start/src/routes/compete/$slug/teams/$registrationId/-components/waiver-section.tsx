/**
 * Waiver Section Component for Team Registration Page
 * Displays competition waivers and allows athletes to sign them.
 * Once signed, waivers are shown as read-only with a signed status.
 */

"use client"

import { useServerFn } from "@tanstack/react-start"
import {
	CheckCircle,
	ChevronDown,
	ChevronUp,
	FileText,
	Loader2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { Waiver, WaiverSignature } from "@/db/schemas/waivers"
import { signWaiverFn } from "@/server-fns/waiver-fns"

interface WaiverSectionProps {
	waivers: Waiver[]
	signatures: WaiverSignature[]
	registrationId: string
	competitionName: string
}

export function WaiverSection({
	waivers,
	signatures,
	registrationId,
	competitionName,
}: WaiverSectionProps) {
	const [signedWaiverIds, setSignedWaiverIds] = useState<Set<string>>(
		new Set(signatures.map((s) => s.waiverId)),
	)
	const [signingWaiverId, setSigningWaiverId] = useState<string | null>(null)
	const [expandedWaiverId, setExpandedWaiverId] = useState<string | null>(null)

	const signWaiver = useServerFn(signWaiverFn)

	// If no waivers, don't render anything
	if (waivers.length === 0) {
		return null
	}

	const requiredWaivers = waivers.filter((w) => w.required)
	const signedCount = requiredWaivers.filter((w) =>
		signedWaiverIds.has(w.id),
	).length
	const allRequiredSigned = signedCount === requiredWaivers.length

	const handleSignWaiver = async (waiverId: string) => {
		setSigningWaiverId(waiverId)

		try {
			const result = await signWaiver({
				data: {
					waiverId,
					registrationId,
				},
			})

			if (result.success) {
				setSignedWaiverIds((prev) => new Set([...prev, waiverId]))
				toast.success("Waiver signed successfully")
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to sign waiver")
		} finally {
			setSigningWaiverId(null)
		}
	}

	const getSignatureDate = (waiverId: string): Date | null => {
		const signature = signatures.find((s) => s.waiverId === waiverId)
		return signature?.signedAt ? new Date(signature.signedAt) : null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileText className="w-5 h-5" />
					Competition Waivers
				</CardTitle>
				<CardDescription>
					{allRequiredSigned ? (
						<span className="flex items-center gap-1 text-green-600">
							<CheckCircle className="w-4 h-4" />
							All required waivers signed
						</span>
					) : (
						<span>
							{signedCount} of {requiredWaivers.length} required waiver
							{requiredWaivers.length !== 1 ? "s" : ""} signed for{" "}
							{competitionName}
						</span>
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{waivers.map((waiver) => {
					const isSigned = signedWaiverIds.has(waiver.id)
					const signedAt = getSignatureDate(waiver.id)
					const isExpanded = expandedWaiverId === waiver.id
					const isSigning = signingWaiverId === waiver.id

					return (
						<Collapsible
							key={waiver.id}
							open={isExpanded}
							onOpenChange={(open) =>
								setExpandedWaiverId(open ? waiver.id : null)
							}
						>
							<div
								className={`border rounded-lg ${isSigned ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" : ""}`}
							>
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="w-full p-4 flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors"
									>
										<div className="flex items-center gap-3">
											{isSigned ? (
												<CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
											) : (
												<FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
											)}
											<div className="text-left">
												<div className="font-medium flex items-center gap-2">
													{waiver.title}
													{waiver.required && !isSigned && (
														<span className="text-destructive text-sm">
															(Required)
														</span>
													)}
												</div>
												{isSigned && signedAt && (
													<p className="text-sm text-muted-foreground">
														Signed on{" "}
														{signedAt.toLocaleDateString(undefined, {
															year: "numeric",
															month: "long",
															day: "numeric",
														})}
													</p>
												)}
											</div>
										</div>
										<div className="flex items-center gap-2">
											{isSigned && (
												<span className="text-sm text-green-600 font-medium">
													Signed
												</span>
											)}
											{isExpanded ? (
												<ChevronUp className="w-4 h-4 text-muted-foreground" />
											) : (
												<ChevronDown className="w-4 h-4 text-muted-foreground" />
											)}
										</div>
									</button>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<div className="px-4 pb-4 space-y-4">
										{/* Waiver Content */}
										<div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/10">
											<WaiverViewer
												content={waiver.content}
												className="prose prose-sm max-w-none dark:prose-invert"
											/>
										</div>

										{/* Sign Button (only if not signed) */}
										{!isSigned && (
											<Button
												onClick={() => handleSignWaiver(waiver.id)}
												disabled={isSigning}
												className="w-full"
											>
												{isSigning ? (
													<>
														<Loader2 className="w-4 h-4 mr-2 animate-spin" />
														Signing...
													</>
												) : (
													<>
														<CheckCircle className="w-4 h-4 mr-2" />I agree to
														this waiver
													</>
												)}
											</Button>
										)}

										{/* Signed confirmation */}
										{isSigned && (
											<div className="flex items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-400">
												<CheckCircle className="w-4 h-4" />
												<span className="text-sm font-medium">
													You have signed this waiver
												</span>
											</div>
										)}
									</div>
								</CollapsibleContent>
							</div>
						</Collapsible>
					)
				})}
			</CardContent>
		</Card>
	)
}
