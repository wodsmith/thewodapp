"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

function shouldHideBrand(pathname: string) {
	// Only hide the brand on organizer routes that have the collapsible sidebar:
	// /compete/organizer/[competitionId]/**
	const segments = pathname.split("/").filter(Boolean)
	return segments[0] === "compete" && segments[1] === "organizer" && segments.length >= 3
}

export function CompeteNavBrand() {
	const pathname = usePathname()

	if (shouldHideBrand(pathname)) return null

	return (
		<Link href="/compete" className="flex items-center gap-2">
			<Image
				src="/wodsmith-logo-no-text.png"
				alt="wodsmith compete"
				width={32}
				height={32}
				className="dark:hidden"
			/>
			<Image
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


