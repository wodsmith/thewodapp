"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import type { Waiver } from "@/db/schemas/waivers"

interface WaiverStatusBadgeProps {
	requiredWaivers: Waiver[]
	signedWaiverIds: string[]
	className?: string
}

/**
 * Displays waiver signature status with a color-coded badge
 * Shows detailed missing waiver information in a popover on hover/click
 */
export function WaiverStatusBadge({
	requiredWaivers,
	signedWaiverIds,
	className,
}: WaiverStatusBadgeProps) {
	// Only consider required waivers for status
	const required = requiredWaivers.filter((w) => w.required)
	const signedCount = required.filter((w) =>
		signedWaiverIds.includes(w.id),
	).length
	const totalCount = required.length

	// If no required waivers, don't show badge
	if (totalCount === 0) {
		return null
	}

	const allSigned = signedCount === totalCount
	const missingWaivers = required.filter((w) => !signedWaiverIds.includes(w.id))

	// All signed - green badge with checkmark
	if (allSigned) {
		return (
			<Badge
				variant="default"
				className={`bg-green-600 hover:bg-green-700 ${className}`}
			>
				<CheckCircle2 className="h-3 w-3 mr-1" />
				Waivers Signed
			</Badge>
		)
	}

	// Some missing - amber badge with popover showing missing waivers
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Badge
					variant="secondary"
					className={`bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer ${className}`}
				>
					<AlertCircle className="h-3 w-3 mr-1" />
					{signedCount}/{totalCount} Signed
				</Badge>
			</PopoverTrigger>
			<PopoverContent className="w-80" align="start">
				<div className="space-y-2">
					<div className="font-semibold text-sm">Missing Waivers</div>
					<ul className="space-y-1 text-sm text-muted-foreground">
						{missingWaivers.map((waiver) => (
							<li key={waiver.id} className="flex items-start gap-2">
								<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
								<span>{waiver.title}</span>
							</li>
						))}
					</ul>
					<p className="text-xs text-muted-foreground pt-2 border-t">
						This athlete needs to sign {missingWaivers.length} waiver
						{missingWaivers.length !== 1 ? "s" : ""} before competing.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	)
}
