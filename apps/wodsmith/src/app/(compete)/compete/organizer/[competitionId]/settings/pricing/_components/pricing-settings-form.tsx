"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, DollarSign, Users, User } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
	updateCompetitionFeeConfig,
	updateDivisionFee,
} from "@/actions/commerce.action"
import { PLATFORM_DEFAULTS } from "@/server/commerce/fee-calculator"

interface Props {
	competition: {
		id: string
		name: string
		defaultRegistrationFeeCents: number
		platformFeePercentage: number | null
		platformFeeFixed: number | null
		passStripeFeesToCustomer: boolean
	}
	divisions: Array<{
		id: string
		label: string
		teamSize: number
	}>
	currentFees: {
		defaultFeeCents: number
		divisionFees: Array<{
			divisionId: string
			divisionLabel: string | undefined
			feeCents: number
		}>
	}
}

// Convert cents to dollars for display
function centsToDollars(cents: number): string {
	return (cents / 100).toFixed(2)
}

// Convert dollars to cents
function dollarsToCents(dollars: string): number {
	const parsed = Number.parseFloat(dollars)
	return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

export function PricingSettingsForm({
	competition,
	divisions,
	currentFees,
}: Props) {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Competition-level settings
	const [defaultFee, setDefaultFee] = useState(
		centsToDollars(competition.defaultRegistrationFeeCents),
	)
	const [passFeesToCustomer, setPassFeesToCustomer] = useState(
		competition.passStripeFeesToCustomer,
	)

	// Division-specific fees (map of divisionId -> fee in dollars or empty string)
	const [divisionFees, setDivisionFees] = useState<Record<string, string>>(() => {
		const fees: Record<string, string> = {}
		for (const fee of currentFees.divisionFees) {
			fees[fee.divisionId] = centsToDollars(fee.feeCents)
		}
		return fees
	})

	// Handle default fee save
	const handleSaveDefaultFee = async () => {
		setIsSubmitting(true)
		try {
			await updateCompetitionFeeConfig({
				competitionId: competition.id,
				defaultRegistrationFeeCents: dollarsToCents(defaultFee),
				passStripeFeesToCustomer: passFeesToCustomer,
			})
			toast.success("Default fee updated")
			router.refresh()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	// Handle division fee update
	const handleDivisionFeeUpdate = async (
		divisionId: string,
		feeValue: string | null,
	) => {
		setIsSubmitting(true)
		try {
			await updateDivisionFee({
				competitionId: competition.id,
				divisionId,
				feeCents: feeValue ? dollarsToCents(feeValue) : null,
			})
			toast.success(
				feeValue ? "Division fee updated" : "Division fee override removed",
			)
			router.refresh()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	// Calculate platform fee display
	const platformPercentage =
		competition.platformFeePercentage ?? PLATFORM_DEFAULTS.platformPercentageBasisPoints
	const platformFixed =
		competition.platformFeeFixed ?? PLATFORM_DEFAULTS.platformFixedCents

	return (
		<div className="space-y-6">
			{/* Default Fee Configuration */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5" />
						Default Registration Fee
					</CardTitle>
					<CardDescription>
						This fee applies to all divisions unless you set a specific fee below
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center gap-4">
						<div className="flex-1 max-w-xs">
							<Label htmlFor="defaultFee">Fee Amount (USD)</Label>
							<div className="relative mt-1.5">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
									$
								</span>
								<Input
									id="defaultFee"
									type="number"
									min="0"
									step="0.01"
									value={defaultFee}
									onChange={(e) => setDefaultFee(e.target.value)}
									className="pl-7"
									disabled={isSubmitting}
								/>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Set to $0 for free registration
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3 py-3 border-t">
						<Checkbox
							id="passFeesToCustomer"
							checked={passFeesToCustomer}
							onCheckedChange={(checked) => setPassFeesToCustomer(checked === true)}
							disabled={isSubmitting}
							className="mt-0.5"
						/>
						<div>
							<Label htmlFor="passFeesToCustomer" className="cursor-pointer">
								Pass Stripe fees to customer
							</Label>
							<p className="text-xs text-muted-foreground">
								When enabled, Stripe processing fees are added to the customer&apos;s
								total instead of being deducted from your payout
							</p>
						</div>
					</div>

					<div className="pt-2">
						<Button
							onClick={handleSaveDefaultFee}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								"Save Default Fee"
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Platform Fee Info */}
			<Card>
				<CardHeader>
					<CardTitle>Platform Fee Structure</CardTitle>
					<CardDescription>
						Wodsmith charges a platform fee on each paid registration
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="p-4 bg-muted rounded-lg">
							<div className="text-2xl font-bold">
								{(platformPercentage / 100).toFixed(1)}%
							</div>
							<div className="text-sm text-muted-foreground">
								Percentage of registration fee
							</div>
						</div>
						<div className="p-4 bg-muted rounded-lg">
							<div className="text-2xl font-bold">
								${(platformFixed / 100).toFixed(2)}
							</div>
							<div className="text-sm text-muted-foreground">
								Fixed fee per registration
							</div>
						</div>
					</div>
					<p className="text-sm text-muted-foreground mt-4">
						Example: For a $50 registration, platform fee is $50 x 2.5% + $2.00 = $3.25
					</p>
				</CardContent>
			</Card>

			{/* Division-Specific Fees */}
			{divisions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Division-Specific Fees</CardTitle>
						<CardDescription>
							Override the default fee for specific divisions (e.g., team divisions
							may cost more)
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{divisions.map((division) => {
								const currentFee = divisionFees[division.id] ?? ""
								const hasOverride = currentFee !== ""
								const effectiveFee = hasOverride ? currentFee : defaultFee
								const isTeam = division.teamSize > 1

								return (
									<div
										key={division.id}
										className="flex items-center justify-between gap-4 p-4 border rounded-lg"
									>
										<div className="flex items-center gap-3">
											{isTeam ? (
												<Badge variant="secondary" className="text-xs">
													<Users className="w-3 h-3 mr-1" />
													Team of {division.teamSize}
												</Badge>
											) : (
												<Badge variant="outline" className="text-xs">
													<User className="w-3 h-3 mr-1" />
													Individual
												</Badge>
											)}
											<span className="font-medium">{division.label}</span>
										</div>

										<div className="flex items-center gap-3">
											<div className="relative w-32">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
													$
												</span>
												<Input
													type="number"
													min="0"
													step="0.01"
													value={currentFee}
													onChange={(e) =>
														setDivisionFees((prev) => ({
															...prev,
															[division.id]: e.target.value,
														}))
													}
													placeholder={effectiveFee}
													className="pl-7"
													disabled={isSubmitting}
												/>
											</div>

											{hasOverride ? (
												<div className="flex gap-2">
													<Button
														size="sm"
														onClick={() =>
															handleDivisionFeeUpdate(
																division.id,
																divisionFees[division.id]!,
															)
														}
														disabled={isSubmitting}
													>
														Save
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => {
															setDivisionFees((prev) => {
																const copy = { ...prev }
																delete copy[division.id]
																return copy
															})
															handleDivisionFeeUpdate(division.id, null)
														}}
														disabled={isSubmitting}
													>
														Remove
													</Button>
												</div>
											) : (
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														setDivisionFees((prev) => ({
															...prev,
															[division.id]: defaultFee,
														}))
													}
													disabled={isSubmitting}
												>
													Override
												</Button>
											)}
										</div>
									</div>
								)
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{divisions.length === 0 && (
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No divisions configured. Set up divisions first to configure
							division-specific pricing.
						</p>
						<Button variant="outline" className="mt-4" asChild>
							<a href={`/compete/organizer/${competition.id}/divisions`}>
								Configure Divisions
							</a>
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
