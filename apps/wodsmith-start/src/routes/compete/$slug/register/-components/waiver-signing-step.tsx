import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Waiver } from "@/db/schemas/waivers"
import { signWaiverFn } from "@/server-fns/waiver-fns"

interface WaiverSigningStepProps {
	waivers: Waiver[]
	onComplete: () => void
	registrationId?: string
	signedWaiverIds?: Set<string>
}

/**
 * Waiver signing step component for registration flow.
 * Displays each required waiver with a checkbox for agreement.
 * Calls signWaiverFn when user checks a box.
 * Enables "Continue" only when all required waivers are signed.
 *
 * @example
 * ```tsx
 * <WaiverSigningStep
 *   waivers={competitionWaivers}
 *   onComplete={() => setStep('payment')}
 *   registrationId={registration?.id}
 * />
 * ```
 */
export function WaiverSigningStep({
	waivers,
	onComplete,
	registrationId,
	signedWaiverIds = new Set(),
}: WaiverSigningStepProps) {
	// Track which waivers have been checked/signed
	const [checkedWaivers, setCheckedWaivers] = useState<Set<string>>(
		new Set(signedWaiverIds),
	)
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Use useServerFn for TanStack Start pattern
	const signWaiver = useServerFn(signWaiverFn)

	// If no waivers, don't render anything
	if (waivers.length === 0) {
		return null
	}

	const allRequiredWaiversSigned = waivers
		.filter((w) => w.required)
		.every((w) => checkedWaivers.has(w.id))

	const handleCheckboxChange = (waiverId: string, checked: boolean) => {
		if (checked) {
			// Add to checked set
			setCheckedWaivers((prev) => new Set([...prev, waiverId]))
		} else {
			// Remove from checked set (only if not already signed)
			if (!signedWaiverIds.has(waiverId)) {
				setCheckedWaivers((prev) => {
					const newSet = new Set(prev)
					newSet.delete(waiverId)
					return newSet
				})
			}
		}
	}

	const handleContinue = async () => {
		setIsSubmitting(true)

		try {
			// Sign all checked waivers that haven't been signed yet
			const unsignedWaivers = waivers.filter(
				(w) => checkedWaivers.has(w.id) && !signedWaiverIds.has(w.id),
			)

			for (const waiver of unsignedWaivers) {
				const result = await signWaiver({
					data: {
						waiverId: waiver.id,
						registrationId,
						ipAddress: undefined,
					},
				})

				if (!result.success) {
					toast.error("Failed to sign waiver")
					setIsSubmitting(false)
					return
				}
			}

			onComplete()
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to sign waivers. Please try again.",
			)
			setIsSubmitting(false)
		}
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Required Waivers</CardTitle>
					<CardDescription>
						Please review and sign all required waivers before continuing
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{waivers.map((waiver) => (
						<Card key={waiver.id} className="border-2">
							<CardHeader>
								<CardTitle className="text-lg">
									{waiver.title}
									{waiver.required && (
										<span className="text-destructive ml-1">*</span>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Waiver Content Viewer */}
								<div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-muted/10">
									<WaiverViewer
										content={waiver.content}
										className="prose prose-sm max-w-none dark:prose-invert"
									/>
								</div>

								{/* Agreement Checkbox */}
								<div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
									<Checkbox
										id={`waiver-${waiver.id}`}
										checked={checkedWaivers.has(waiver.id)}
										onCheckedChange={(checked) =>
											handleCheckboxChange(waiver.id, checked === true)
										}
										disabled={signedWaiverIds.has(waiver.id)}
									/>
									<Label
										htmlFor={`waiver-${waiver.id}`}
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
									>
										I have read and agree to this waiver
										{signedWaiverIds.has(waiver.id) && (
											<span className="text-muted-foreground ml-2">
												(Already signed)
											</span>
										)}
									</Label>
								</div>
							</CardContent>
						</Card>
					))}

					<Button
						onClick={handleContinue}
						disabled={!allRequiredWaiversSigned || isSubmitting}
						className="w-full"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Processing...
							</>
						) : (
							"Continue to Payment"
						)}
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
