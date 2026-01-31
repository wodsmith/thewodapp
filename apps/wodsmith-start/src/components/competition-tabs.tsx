"use client"

import { Link, useLocation } from "@tanstack/react-router"
import { Calendar, Dumbbell, List, Trophy } from "lucide-react"
import { cn } from "@/utils/cn"

interface CompetitionTabsProps {
	slug: string
}

const tabs = [
	{ label: "Event Details", href: "", icon: List },
	{ label: "Workouts", href: "/workouts", icon: Dumbbell },
	{ label: "Schedule", href: "/schedule", icon: Calendar },
	{ label: "Leaderboard", href: "/leaderboard", icon: Trophy },
]

export function CompetitionTabs({ slug }: CompetitionTabsProps) {
	const location = useLocation()
	const pathname = location.pathname
	const basePath = `/compete/${slug}`

	return (
		<div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
			<nav className="flex h-auto gap-1 overflow-x-auto">
				{tabs.map((tab) => {
					const tabPath = `${basePath}${tab.href}`
					const Icon = tab.icon
					// For the root tab (Event Details), check exact match
					// For other tabs, check if pathname starts with the tab path
					const isActive =
						tab.href === ""
							? pathname === basePath
							: pathname.startsWith(tabPath)

					return (
						<Link
							key={tab.href}
							to={tabPath}
							className={cn(
								"flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
								isActive
									? "bg-orange-500 text-white"
									: "text-muted-foreground hover:bg-white/10 hover:text-foreground",
							)}
						>
							<Icon className="h-4 w-4" />
							{tab.label}
						</Link>
					)
				})}
			</nav>
		</div>
	)
}
