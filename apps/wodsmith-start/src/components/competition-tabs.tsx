"use client"

import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { Calendar, Dumbbell, List, Trophy } from "lucide-react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
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
	const navigate = useNavigate()
	const pathname = location.pathname
	const basePath = `/compete/${slug}`

	// Determine active tab value for select
	const getActiveTabValue = () => {
		for (const tab of tabs) {
			const tabPath = `${basePath}${tab.href}`
			const isActive =
				tab.href === "" ? pathname === basePath : pathname.startsWith(tabPath)
			if (isActive) return tab.href || "/"
		}
		return "/"
	}

	const handleSelectChange = (value: string) => {
		const href = value === "/" ? "" : value
		navigate({ to: `${basePath}${href}` })
	}

	const activeTab = tabs.find((tab) => {
		const tabPath = `${basePath}${tab.href}`
		return tab.href === ""
			? pathname === basePath
			: pathname.startsWith(tabPath)
	})
	const ActiveIcon = activeTab?.icon || List

	return (
		<div className="rounded-2xl border border-black/10 bg-black/5 p-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
			{/* Mobile: Select menu */}
			<div className="sm:hidden">
				<Select
					value={getActiveTabValue()}
					onValueChange={handleSelectChange}
				>
					<SelectTrigger className="w-full bg-transparent border-0 h-10 font-medium">
						<div className="flex items-center gap-2">
							<ActiveIcon className="h-4 w-4" />
							<SelectValue />
						</div>
					</SelectTrigger>
					<SelectContent>
						{tabs.map((tab) => (
							<SelectItem
								key={tab.href || "/"}
								value={tab.href || "/"}
								className="cursor-pointer"
							>
								{tab.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Desktop: Tab navigation */}
			<nav className="hidden sm:flex h-auto gap-1 overflow-x-auto">
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
									: "text-muted-foreground hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10",
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
