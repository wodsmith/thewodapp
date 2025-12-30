import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getRegistrationFeeBreakdownFn } from "@/server-fns/registration-fns"

type FeeBreakdownProps = {
	competitionId: string
	divisionId: string | null
}

export function FeeBreakdown({ competitionId, divisionId }: FeeBreakdownProps) {
	const [fees, setFees] = useState<{
		isFree: boolean
		registrationFeeCents?: number
		platformFeeCents?: number
		stripeFeeCents?: number
		totalChargeCents?: number
		stripeFeesPassedToCustomer?: boolean
		platformFeesPassedToCustomer?: boolean
	} | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		if (!divisionId) {
			setFees(null)
			return
		}

		const fetchFees = async () => {
			setIsLoading(true)
			try {
				const result = await getRegistrationFeeBreakdownFn({
					data: { competitionId, divisionId },
				})
				setFees(result)
			} catch (error) {
				console.error("Failed to fetch registration fee breakdown:", error)
				setFees(null)
				toast.error("Failed to load registration fees. Please try again.")
			} finally {
				setIsLoading(false)
			}
		}

		fetchFees()
	}, [competitionId, divisionId])

	if (!divisionId) {
		return (
			<p className="text-muted-foreground text-sm">
				Select a division to see pricing
			</p>
		)
	}

	if (isLoading) return <Skeleton className="h-20 w-full" />

	if (!fees) return <Skeleton className="h-20 w-full" />

	if (fees.isFree) {
		return (
			<div className="flex items-center gap-2">
				<Badge variant="secondary" className="text-green-600 bg-green-100">
					Free Registration
				</Badge>
			</div>
		)
	}

	const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

	return (
		<div className="space-y-2 text-sm">
			<div className="flex justify-between">
				<span>Registration Fee</span>
				<span className="font-medium">
					{formatCents(fees.registrationFeeCents ?? 0)}
				</span>
			</div>
			{fees.platformFeesPassedToCustomer &&
				fees.platformFeeCents &&
				fees.platformFeeCents > 0 && (
					<div className="flex justify-between text-muted-foreground">
						<span>Platform Fee</span>
						<span>{formatCents(fees.platformFeeCents)}</span>
					</div>
				)}
			{fees.stripeFeesPassedToCustomer &&
				fees.stripeFeeCents &&
				fees.stripeFeeCents > 0 && (
					<div className="flex justify-between text-muted-foreground">
						<span>Processing Fee</span>
						<span>{formatCents(fees.stripeFeeCents)}</span>
					</div>
				)}
			<div className="flex justify-between font-medium pt-2 border-t">
				<span>Total</span>
				<span className="text-lg">
					{formatCents(fees.totalChargeCents ?? 0)}
				</span>
			</div>
		</div>
	)
}
