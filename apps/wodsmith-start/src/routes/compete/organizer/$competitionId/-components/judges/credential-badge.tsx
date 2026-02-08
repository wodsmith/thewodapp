"use client"

import { Badge } from "@/components/ui/badge"

interface CredentialBadgeProps {
	credentials?: string
	className?: string
	/** Use compact display (L1, L2, Med instead of full text) */
	compact?: boolean
}

/**
 * Color-coded badge displaying judge credential level (L1, L2, Medical, etc.)
 */
export function CredentialBadge({
	credentials,
	className,
	compact = false,
}: CredentialBadgeProps) {
	if (!credentials) {
		return (
			<Badge variant="outline" className={className}>
				{compact ? "–" : "No Credential"}
			</Badge>
		)
	}

	// Parse common credential patterns for color coding
	const credLower = credentials.toLowerCase()

	// Determine variant based on credential level
	let variant: "default" | "secondary" | "destructive" | "outline" = "outline"
	let shortLabel = credentials

	if (credLower.includes("l2") || credLower.includes("level 2")) {
		variant = "default" // Highest level judges
		shortLabel = "L2"
	} else if (credLower.includes("l1") || credLower.includes("level 1")) {
		variant = "secondary"
		shortLabel = "L1"
	} else if (credLower.includes("medical") || credLower.includes("emt")) {
		variant = "destructive" // Red for medical (high visibility)
		shortLabel = "Med"
	}

	return (
		<Badge variant={variant} className={className} title={credentials}>
			{compact ? shortLabel : credentials}
		</Badge>
	)
}
