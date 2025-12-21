import type { Metadata } from "next"
import type React from "react"
import { SITE_URL } from "@/constants"

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	openGraph: {
		title: "WODsmith Compete",
		description: "Find and register for CrossFit competitions.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith Compete")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith Compete",
			},
		],
	},
}

export default function CompeteLayout({
	children,
}: {
	children: React.ReactNode
}) {
	// Note: CompeteNav and footer are added by child layouts
	// This allows organizer routes to use full-width sidebar layout
	// while public routes use container-constrained layout
	return <>{children}</>
}
