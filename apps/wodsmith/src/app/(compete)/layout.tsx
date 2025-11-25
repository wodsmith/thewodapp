import type { Metadata } from "next"
import type React from "react"
import CompeteNav from "@/components/nav/compete-nav"
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
	return (
		<div className="flex min-h-screen flex-col">
			<CompeteNav />

			<main className="container mx-auto flex-1 pt-4 sm:p-4">{children}</main>

			<footer className="border-black border-t-2 p-4">
				<div className="container mx-auto">
					<p className="text-center">
						&copy; {new Date().getFullYear()} WODsmith. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	)
}
