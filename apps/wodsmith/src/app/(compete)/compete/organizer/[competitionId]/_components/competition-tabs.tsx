"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface CompetitionTabsProps {
	competitionId: string
}

const tabs = [
	{ label: "Overview", href: "" },
	{ label: "Divisions", href: "/divisions" },
	{ label: "Events", href: "/events" },
	{ label: "Results", href: "/results" },
	{ label: "Schedule", href: "/schedule" },
	{ label: "Athletes", href: "/athletes" },
	{ label: "Pricing", href: "/pricing" },
	{ label: "Revenue", href: "/revenue" },
	{ label: "Danger Zone", href: "/danger-zone" },
] as const

export function CompetitionTabs({ competitionId }: CompetitionTabsProps) {
	const pathname = usePathname()
	const basePath = `/compete/organizer/${competitionId}`

	const isActive = (tabHref: string) => {
		const fullPath = `${basePath}${tabHref}`
		if (tabHref === "") {
			// Overview is active only when exactly on base path
			return pathname === basePath
		}
		return pathname.startsWith(fullPath)
	}

	return (
		<div className="border-b">
			<nav className="flex gap-4 overflow-x-auto">
				{tabs.map((tab) => {
					const active = isActive(tab.href)
					const fullHref = `${basePath}${tab.href}`

					return active ? (
						<span
							key={tab.label}
							className={cn(
								"px-4 py-2 border-b-2 border-primary font-medium",
								tab.label === "Danger Zone" && "text-destructive",
							)}
						>
							{tab.label}
						</span>
					) : (
						<Link
							key={tab.label}
							href={fullHref}
							className={cn(
								"px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors",
								tab.label === "Danger Zone" &&
									"text-destructive/70 hover:text-destructive",
							)}
						>
							{tab.label}
						</Link>
					)
				})}
			</nav>
		</div>
	)
}
