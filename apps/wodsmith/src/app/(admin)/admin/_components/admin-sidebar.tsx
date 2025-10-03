"use client"

import {
	AcademicCapIcon,
	AdjustmentsHorizontalIcon,
	BookOpenIcon,
	BuildingOfficeIcon,
	CalendarDaysIcon,
	ChevronDownIcon,
	ClockIcon,
	DocumentTextIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"
import { ScrollShadow } from "@heroui/react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useActiveNavItem } from "@/hooks/useActiveNavItem"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { AdminTeamSwitcher } from "./admin-team-switcher"

interface AdminNavItem {
	title: string
	href: Route
	icon: React.ComponentType<{ className?: string }>
	items?: AdminNavItem[]
}

const getAdminNavItems = (currentTeamId: string): AdminNavItem[] => [
	{
		title: "Team Scheduling",
		href: `/admin/teams/${currentTeamId}` as Route,
		icon: CalendarDaysIcon,
	},
	{
		title: "Schedule Coaches",
		href: `/admin/teams/${currentTeamId}/schedule-week` as Route,
		icon: ClockIcon,
	},
	{
		title: "Programming",
		href: `/admin/teams/${currentTeamId}/programming/` as Route,
		icon: BookOpenIcon,
	},
	{
		title: "Edit Workout Scaling",
		href: `/admin/teams/${currentTeamId}/scaling` as Route,
		icon: AdjustmentsHorizontalIcon,
	},
	{
		title: "Class Scheduling",
		href: `/admin/teams/${currentTeamId}` as Route,
		icon: CalendarDaysIcon,
		items: [
			{
				title: "Classes",
				href: `/admin/teams/${currentTeamId}/classes` as Route,
				icon: AcademicCapIcon,
			},
			{
				title: "Schedule Templates",
				href: `/admin/teams/${currentTeamId}/schedule-templates` as Route,
				icon: DocumentTextIcon,
			},
      {
        title: "Coaches",
        href: `/admin/teams/${currentTeamId}/coaches` as Route,
        icon: UserGroupIcon,
      },
      {
        title: "Gym Setup",
        href: `/admin/teams/${currentTeamId}/gym-setup` as Route,
        icon: BuildingOfficeIcon,
      },
		],
	},

]

interface AdminSidebarProps {
	currentTeamId?: string
}

export function AdminSidebar({ currentTeamId }: AdminSidebarProps) {
	const pathname = usePathname()
	const isLgAndSmaller = useMediaQuery("LG_AND_SMALLER")
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["Class Scheduling"]),
	)

	const navItems = currentTeamId ? getAdminNavItems(currentTeamId) : []
	const isActiveNavItem = useActiveNavItem(pathname, navItems)

	const toggleSection = (title: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev)
			if (next.has(title)) {
				next.delete(title)
			} else {
				next.add(title)
			}
			return next
		})
	}

	return (
		<div className="space-y-4">
			{/* Team Switcher Header */}
			{currentTeamId ? (
				<>
					<AdminTeamSwitcher currentTeamId={currentTeamId} />
					{/* Navigation */}
					<div className="overflow-x-auto overflow-y-visible lg:overflow-x-visible">
						<ScrollShadow
							className="w-full pb-2"
							orientation="horizontal"
							isEnabled={isLgAndSmaller}
						>
							<nav className="flex items-center lg:items-stretch space-x-2 pb-2 lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1 min-w-max lg:min-w-full lg:w-full">
								{navItems.map((item) => {
									const isActive = isActiveNavItem(item)
									const isExpanded = expandedSections.has(item.title)

									if (item.items) {
										// On desktop (lg+), show as collapsible section
										if (!isLgAndSmaller) {
											return (
												<div
													key={`section-${item.title}`}
													className="w-full"
												>
													<button
														type="button"
														onClick={() => toggleSection(item.title)}
														className={cn(
															buttonVariants({
																variant: "ghost",
															}),
															"justify-start hover:no-underline whitespace-nowrap w-full",
														)}
													>
														<item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
														<span className="flex-1 text-left">{item.title}</span>
														<ChevronDownIcon
															className={cn(
																"h-4 w-4 flex-shrink-0 transition-transform",
																isExpanded && "rotate-180",
															)}
														/>
													</button>
													{isExpanded && (
														<div className="ml-6 space-y-1 mt-1">
															{item.items.map((subItem) => {
																const isSubActive = isActiveNavItem(subItem)
																return (
																	<Link
																		key={subItem.href}
																		href={subItem.href}
																		className={cn(
																			buttonVariants({
																				variant: isSubActive ? "default" : "ghost",
																			}),
																			"justify-start hover:no-underline whitespace-nowrap w-full",
																		)}
																	>
																		<subItem.icon className="mr-2 h-4 w-4 flex-shrink-0" />
																		{subItem.title}
																	</Link>
																)
															})}
														</div>
													)}
												</div>
											)
										}

										// On mobile/tablet, show as dropdown menu
										return (
											<DropdownMenu key={`section-${item.title}`}>
												<DropdownMenuTrigger asChild>
													<button
														type="button"
														className={cn(
															buttonVariants({
																variant: "ghost",
															}),
															"justify-start hover:no-underline whitespace-nowrap flex-shrink-0",
														)}
													>
														<item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
														<span>{item.title}</span>
														<ChevronDownIcon className="ml-2 h-4 w-4 flex-shrink-0" />
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start" className="w-56">
													{item.items.map((subItem) => {
														const isSubActive = isActiveNavItem(subItem)
														return (
															<DropdownMenuItem key={subItem.href} asChild>
																<Link
																	href={subItem.href}
																	className={cn(
																		"flex items-center w-full cursor-pointer",
																		isSubActive && "bg-accent",
																	)}
																>
																	<subItem.icon className="mr-2 h-4 w-4 flex-shrink-0" />
																	{subItem.title}
																</Link>
															</DropdownMenuItem>
														)
													})}
												</DropdownMenuContent>
											</DropdownMenu>
										)
									}

									return (
										<Link
											key={item.href}
											href={item.href}
											className={cn(
												buttonVariants({
													variant: isActive ? "default" : "ghost",
												}),
												"justify-start hover:no-underline whitespace-nowrap flex-shrink-0 lg:w-full",
											)}
										>
											<item.icon className="mr-2 h-4 w-4" />
											{item.title}
										</Link>
									)
								})}
							</nav>
						</ScrollShadow>
					</div>
				</>
			) : (
				<div className="flex items-center gap-3 px-4 py-2 border rounded-md w-full min-w-0">
					<BuildingOfficeIcon className="h-6 w-6 flex-shrink-0" />
					<span className="truncate flex-1 min-w-0">Select Team</span>
				</div>
			)}
		</div>
	)
}
