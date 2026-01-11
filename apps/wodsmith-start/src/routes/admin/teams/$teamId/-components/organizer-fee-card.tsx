/**
 * Organizer Fee Management Card
 *
 * Admin component for setting custom platform fees for organizing teams.
 * Allows granting "founding organizer" status with reduced platform fees.
 */

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { DollarSign, Loader2, Percent, Star } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	FOUNDING_ORGANIZER_DEFAULTS,
	PLATFORM_DEFAULTS,
} from "@/server/commerce/utils"
import { updateOrganizerFeeFn } from "@/server-fns/admin-team-fns"

interface Props {
	team: {
		id: string
		name: string
		organizerFeePercentage?: number | null
		organizerFeeFixed?: number | null
	}
}

export function OrganizerFeeCard({ team }: Props) {
	const router = useRouter()
	const updateFee = useServerFn(updateOrganizerFeeFn)
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Local state for form
	const [percentage, setPercentage] = useState(
		team.organizerFeePercentage != null
			? (team.organizerFeePercentage / 100).toString()
			: "",
	)
	const [fixed, setFixed] = useState(
		team.organizerFeeFixed != null
			? (team.organizerFeeFixed / 100).toFixed(2)
			: "",
	)

	const hasCustomFee =
		team.organizerFeePercentage != null || team.organizerFeeFixed != null

	// Get effective fee display values
	const effectivePercentage =
		team.organizerFeePercentage ?? PLATFORM_DEFAULTS.platformPercentageBasisPoints
	const effectiveFixed =
		team.organizerFeeFixed ?? PLATFORM_DEFAULTS.platformFixedCents

	const handleSave = async () => {
		setIsSubmitting(true)
		try {
			const percentageValue = percentage
				? Math.round(Number.parseFloat(percentage) * 100)
				: null
			const fixedValue = fixed
				? Math.round(Number.parseFloat(fixed) * 100)
				: null

			await updateFee({
				data: {
					teamId: team.id,
					organizerFeePercentage: percentageValue,
					organizerFeeFixed: fixedValue,
				},
			})
			toast.success("Organizer fee updated")
			await router.invalidate()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleApplyFoundingRate = async () => {
		setIsSubmitting(true)
		try {
			await updateFee({
				data: {
					teamId: team.id,
					organizerFeePercentage:
						FOUNDING_ORGANIZER_DEFAULTS.platformPercentageBasisPoints,
					organizerFeeFixed: FOUNDING_ORGANIZER_DEFAULTS.platformFixedCents,
				},
			})
			setPercentage(
				(FOUNDING_ORGANIZER_DEFAULTS.platformPercentageBasisPoints / 100).toString(),
			)
			setFixed(
				(FOUNDING_ORGANIZER_DEFAULTS.platformFixedCents / 100).toFixed(2),
			)
			toast.success("Applied founding organizer rate")
			await router.invalidate()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to apply")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleResetToDefault = async () => {
		setIsSubmitting(true)
		try {
			await updateFee({
				data: {
					teamId: team.id,
					organizerFeePercentage: null,
					organizerFeeFixed: null,
				},
			})
			setPercentage("")
			setFixed("")
			toast.success("Reset to standard platform fee")
			await router.invalidate()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to reset")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<DollarSign className="h-5 w-5" />
							Organizer Platform Fee
						</CardTitle>
						<CardDescription>
							Set custom platform fees for this organizing team
						</CardDescription>
					</div>
					{hasCustomFee && (
						<Badge variant="secondary" className="flex items-center gap-1">
							<Star className="h-3 w-3" />
							Custom Rate
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Current Fee Display */}
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="p-4 bg-muted rounded-lg">
						<div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
							<Percent className="h-4 w-4" />
							Percentage
						</div>
						<div className="text-2xl font-bold">
							{(effectivePercentage / 100).toFixed(1)}%
						</div>
						<div className="text-xs text-muted-foreground">
							{hasCustomFee ? "Custom rate" : "Platform default"}
						</div>
					</div>
					<div className="p-4 bg-muted rounded-lg">
						<div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
							<DollarSign className="h-4 w-4" />
							Fixed Fee
						</div>
						<div className="text-2xl font-bold">
							${(effectiveFixed / 100).toFixed(2)}
						</div>
						<div className="text-xs text-muted-foreground">
							{hasCustomFee ? "Custom rate" : "Platform default"}
						</div>
					</div>
				</div>

				{/* Fee Example */}
				<div className="p-3 bg-accent/50 rounded-lg text-sm">
					<strong>Example:</strong> For a $50 registration, platform fee is $50
					x {(effectivePercentage / 100).toFixed(1)}% + $
					{(effectiveFixed / 100).toFixed(2)} ={" "}
					<strong>
						${((50 * effectivePercentage) / 10000 + effectiveFixed / 100).toFixed(2)}
					</strong>
				</div>

				{/* Quick Actions */}
				<div className="flex flex-wrap gap-2">
					{!hasCustomFee ? (
						<Button
							variant="outline"
							onClick={handleApplyFoundingRate}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Star className="h-4 w-4 mr-2" />
							)}
							Apply Founding Organizer Rate (
							{(FOUNDING_ORGANIZER_DEFAULTS.platformPercentageBasisPoints / 100).toFixed(1)}%
							+ ${(FOUNDING_ORGANIZER_DEFAULTS.platformFixedCents / 100).toFixed(2)})
						</Button>
					) : (
						<Button
							variant="outline"
							onClick={handleResetToDefault}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : null}
							Reset to Standard Rate (
							{(PLATFORM_DEFAULTS.platformPercentageBasisPoints / 100).toFixed(1)}% + $
							{(PLATFORM_DEFAULTS.platformFixedCents / 100).toFixed(2)})
						</Button>
					)}
				</div>

				{/* Custom Fee Form */}
				<div className="border-t pt-4">
					<p className="text-sm font-medium mb-3">Custom Fee Override</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="feePercentage">Percentage (%)</Label>
							<div className="relative mt-1.5">
								<Input
									id="feePercentage"
									type="number"
									min="0"
									max="100"
									step="0.1"
									value={percentage}
									onChange={(e) => setPercentage(e.target.value)}
									placeholder={`${PLATFORM_DEFAULTS.platformPercentageBasisPoints / 100}`}
									disabled={isSubmitting}
								/>
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
									%
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Leave empty to use platform default
							</p>
						</div>
						<div>
							<Label htmlFor="feeFixed">Fixed Fee (USD)</Label>
							<div className="relative mt-1.5">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
									$
								</span>
								<Input
									id="feeFixed"
									type="number"
									min="0"
									step="0.01"
									value={fixed}
									onChange={(e) => setFixed(e.target.value)}
									placeholder={`${PLATFORM_DEFAULTS.platformFixedCents / 100}`}
									className="pl-7"
									disabled={isSubmitting}
								/>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Leave empty to use platform default
							</p>
						</div>
					</div>
					<Button
						className="mt-4"
						onClick={handleSave}
						disabled={isSubmitting || (!percentage && !fixed)}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							"Save Custom Fee"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
