"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface CompetitionTabsProps {
	slug: string
	registerButton: React.ReactNode
}

const tabs = [
	{ label: "Event Details", href: "" },
	{ label: "Workouts", href: "/workouts" },
	{ label: "Schedule", href: "/schedule" },
	{ label: "Leaderboard", href: "/leaderboard" },
]

export function CompetitionTabs({ slug, registerButton }: CompetitionTabsProps) {
	const pathname = usePathname()
	const basePath = `/compete/${slug}`

	return (
		<div className="border-b bg-background sticky top-0 z-10">
			<div className="container mx-auto">
				<div className="flex items-center justify-between gap-2">
					<nav className="flex h-auto gap-0 overflow-x-auto">
						{tabs.map((tab) => {
							const tabPath = `${basePath}${tab.href}`
							// For the root tab (Event Details), check exact match
							// For other tabs, check if pathname starts with the tab path
							const isActive =
								tab.href === ""
									? pathname === basePath
									: pathname.startsWith(tabPath)

							return (
								<Link
									key={tab.href}
									href={tabPath}
									className={cn(
										"px-4 py-3 text-sm font-medium transition-colors border-b-2",
										isActive
											? "border-teal-500 text-foreground"
											: "border-transparent text-muted-foreground hover:text-foreground",
									)}
								>
									{tab.label}
								</Link>
							)
						})}
					</nav>
					<div className="py-2 pr-4">{registerButton}</div>
				</div>
			</div>
		</div>
	)
}
