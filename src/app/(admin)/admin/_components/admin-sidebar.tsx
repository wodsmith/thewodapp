"use client"

import {
	AcademicCapIcon,
	BookOpenIcon,
	CalendarDaysIcon,
	UserGroupIcon,
	BuildingOfficeIcon,
	DocumentTextIcon,
} from "@heroicons/react/24/outline"
import { ScrollShadow } from "@heroui/react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { useActiveNavItem } from "@/hooks/useActiveNavItem"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { AdminTeamSwitcher } from "./admin-team-switcher"

interface AdminNavItem {
	title: string
	href: Route
	icon: React.ComponentType<{ className?: string }>
}

const getAdminNavItems = (currentTeamId: string): AdminNavItem[] => [
	{
		title: "Team Scheduling",
		href: `/admin/teams/${currentTeamId}` as Route,
		icon: CalendarDaysIcon,
	},
	{
		title: "Programming",
		href: `/admin/teams/${currentTeamId}/programming/` as Route,
		icon: BookOpenIcon,
	},
	{
		title: "Coaches",
		href: `/admin/teams/${currentTeamId}/coaches` as Route,
		icon: UserGroupIcon,
	},
	{
		title: "Classes",
		href: `/admin/teams/${currentTeamId}/classes` as Route,
		icon: AcademicCapIcon,
	},
	{
		title: "Gym Setup",
		href: `/admin/teams/${currentTeamId}/gym-setup` as Route,
		icon: BuildingOfficeIcon,
	},
	{
		title: "Schedule Templates",
		href: `/admin/teams/${currentTeamId}/schedule-templates` as Route,
		icon: DocumentTextIcon,
	},
]

interface AdminSidebarProps {
	currentTeamId?: string
}

export function AdminSidebar({ currentTeamId }: AdminSidebarProps) {
	const pathname = usePathname()
	const isLgAndSmaller = useMediaQuery("LG_AND_SMALLER")

	const navItems = currentTeamId ? getAdminNavItems(currentTeamId) : []
	const isActiveNavItem = useActiveNavItem(pathname, navItems)

	return (
		<div className="space-y-4">
			{/* Team Switcher Header */}
			{currentTeamId ? (
				<>
					<AdminTeamSwitcher currentTeamId={currentTeamId} />
					{/* Navigation */}
					<div className="overflow-x-auto lg:overflow-x-visible">
						<ScrollShadow
							className="w-full lg:w-auto pb-2"
							orientation="horizontal"
							isEnabled={isLgAndSmaller}
						>
							<nav className="flex items-center lg:items-stretch space-x-2 pb-2 lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1 min-w-max lg:min-w-0">
								{navItems.map((item) => {
									const isActive = isActiveNavItem(item)

									return (
										<Link
											key={item.href}
											href={item.href}
											className={cn(
												buttonVariants({ variant: "ghost" }),
												isActive
													? "bg-orange text-black hover:bg-orange-600 border-2 border-primary shadow-[2px_2px_0px_0px] shadow-primary font-mono"
													: "hover:bg-orange hover:text-black border-2 border-transparent hover:border-primary hover:shadow-[2px_2px_0px_0px] hover:shadow-primary font-mono",
												"justify-start hover:no-underline whitespace-nowrap flex-shrink-0",
											)}
										>
											<item.icon
												className={cn(
													isActive ? "text-black" : "text-white",
													"mr-2 h-4 w-4",
												)}
											/>
											{item.title}
										</Link>
									)
								})}
							</nav>
						</ScrollShadow>
					</div>
				</>
			) : (
<<<<<<< HEAD
				<div className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary">
					<BuildingOfficeIcon className="h-6 w-6" />
					<span className="text-lg font-mono font-bold">Select Team</span>
||||||| b7b34ab
				<div className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary">
					<Building2 className="h-6 w-6" />
					<span className="text-lg font-mono font-bold">Select Team</span>
=======
				<div className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary w-full min-w-0">
					<BuildingOfficeIcon className="h-6 w-6 flex-shrink-0" />
					<span className="text-lg font-mono font-bold truncate flex-1 min-w-0">
						Select Team
					</span>
>>>>>>> ae9dfb438c567352f9acbec6c84df784882a8b1f
				</div>
			)}
		</div>
	)
}
