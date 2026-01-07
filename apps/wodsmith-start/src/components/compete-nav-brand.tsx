"use client"

import { Link } from "@tanstack/react-router"

export function CompeteNavBrand() {
	return (
		<Link to="/compete" className="flex items-center gap-2">
			<img
				src="/wodsmith-logo-no-text.png"
				alt="wodsmith compete"
				width={32}
				height={32}
				className="dark:hidden"
			/>
			<img
				src="/wodsmith-logo-no-text.png"
				alt="wodsmith compete"
				width={32}
				height={32}
				className="hidden dark:block"
			/>
			<h1 className="text-2xl text-foreground dark:text-dark-foreground">
				<span className="font-black uppercase">wod</span>smith{" "}
				<span className="font-medium text-amber-600 dark:text-amber-500">
					Compete
				</span>
			</h1>
		</Link>
	)
}
