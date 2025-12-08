"use client"

import { CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface MobileRegistrationBarProps {
	slug: string
	isLoggedIn: boolean
	isRegistered: boolean
	registrationOpen: boolean
	registrationClosed: boolean
	registrationNotYetOpen: boolean
	registrationClosesAt: Date | number | null
	priceRange?: { min: number; max: number } | null
}

function formatPrice(cents: number): string {
	if (cents === 0) return "Free"
	return `$${(cents / 100).toFixed(0)}`
}

function getDaysUntil(date: Date | number): number {
	const target = typeof date === "number" ? new Date(date) : date
	const now = new Date()
	const diff = target.getTime() - now.getTime()
	return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function MobileRegistrationBar({
	slug,
	isLoggedIn,
	isRegistered,
	registrationOpen,
	registrationClosed,
	registrationNotYetOpen,
	registrationClosesAt,
	priceRange,
}: MobileRegistrationBarProps) {
	// Don't show bar if registration is closed or not relevant
	if (registrationClosed && !isRegistered) {
		return null
	}

	const daysLeft = registrationClosesAt ? getDaysUntil(registrationClosesAt) : null

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background border-t shadow-lg">
			<div className="flex items-center justify-between gap-3 px-4 py-3">
				{/* Left side: Price or status info */}
				<div className="flex flex-col min-w-0">
					{isRegistered ? (
						<div className="flex items-center gap-1.5 text-green-600">
							<CheckCircle2 className="h-4 w-4 shrink-0" />
							<span className="font-semibold text-sm">You're Registered</span>
						</div>
					) : (
						<>
							{priceRange && (
								<span className="font-semibold text-sm">
									{priceRange.min === priceRange.max
										? formatPrice(priceRange.min)
										: `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`}
								</span>
							)}
							{daysLeft !== null && daysLeft > 0 && daysLeft <= 14 && (
								<span className="text-xs text-amber-600 flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{daysLeft} day{daysLeft === 1 ? "" : "s"} left to register
								</span>
							)}
						</>
					)}
				</div>

				{/* Right side: CTA button */}
				<div className="shrink-0">
					{isRegistered ? (
						<Button asChild size="sm" variant="outline">
							<Link href={`/compete/${slug}/teams`}>View Team</Link>
						</Button>
					) : registrationNotYetOpen ? (
						<Badge variant="secondary" className="text-sm py-1.5 px-3">
							Coming Soon
						</Badge>
					) : registrationOpen ? (
						isLoggedIn ? (
							<Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500">
								<Link href={`/compete/${slug}/register`}>Register Now</Link>
							</Button>
						) : (
							<Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500">
								<Link href={`/sign-in?redirect=/compete/${slug}/register`}>
									Sign In to Register
								</Link>
							</Button>
						)
					) : null}
				</div>
			</div>
		</div>
	)
}
