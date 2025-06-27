import type { Metadata } from "next"
import type React from "react"
import MainNav from "@/components/nav/main-nav"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	openGraph: {
		title: "WODsmith", // Default title for layout
		description: "Track your workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith",
			},
		],
	},
}

export default function MainLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<div className="flex min-h-screen flex-col">
			<MainNav />

			<main className="container mx-auto flex-1 p-4">{children}</main>

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
