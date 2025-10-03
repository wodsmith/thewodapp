"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Zap, Users, BookOpen, Settings, Home } from "lucide-react"

export const quickActions = [
	{
		title: "Dashboard",
		icon: Home,
		href: "/admin/teams/schedule",
	},
	{
		title: "Generate Schedule",
		icon: Zap,
		href: "/admin/teams/schedule/generate",
	},
	{
		title: "Manage Coaches",
		icon: Users,
		href: "/admin/teams/schedule/coaches",
	},
	{
		title: "Class Catalog",
		icon: BookOpen,
		href: "/admin/teams/schedule/classes",
	},
	{
		title: "Gym Setup",
		icon: Settings,
		href: "/admin/teams/schedule/gym-setup",
	},
] as const

export function SubNav() {
	const pathname = usePathname()

	return (
		<nav
			className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1"
			aria-label="secondary navigation"
		>
			{quickActions.map((item) => (
				<Link
					key={item.title}
					href={item.href}
					className={cn(
						buttonVariants({ variant: "ghost" }),
						pathname === item.href
							? "bg-muted hover:bg-muted"
							: "hover:bg-transparent hover:underline",
						"justify-start",
					)}
				>
					<item.icon className="mr-2 h-4 w-4" />
					{item.title}
				</Link>
			))}
		</nav>
	)
}
