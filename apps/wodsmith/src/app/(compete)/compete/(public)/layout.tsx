import type React from "react"
import CompeteNav from "@/components/nav/compete-nav"

export default function CompetePublicLayout({
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
