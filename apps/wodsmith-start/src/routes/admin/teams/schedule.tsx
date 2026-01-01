/**
 * Admin Teams Schedule Layout Route
 *
 * Layout for the AI-powered gym scheduling feature.
 * Provides navigation between schedule dashboard, coach management, class catalog, etc.
 */

import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
} from "@tanstack/react-router"
import { BookOpen, Home, Settings, Users, Zap } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/utils/cn"

export const Route = createFileRoute("/admin/teams/schedule")({
	component: ScheduleLayout,
})

/**
 * Navigation items for the schedule section
 */
const scheduleNavItems = [
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

function ScheduleSubNav() {
	const matches = useMatches()
	const currentPath = matches[matches.length - 1]?.pathname ?? ""

	return (
		<nav
			className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1"
			aria-label="secondary navigation"
		>
			{scheduleNavItems.map((item) => (
				<Link
					key={item.title}
					to={item.href}
					className={cn(
						buttonVariants({ variant: "ghost" }),
						currentPath === item.href
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

function ScheduleLayout() {
	return (
		<div className="flex min-h-screen w-full flex-col">
			<main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
				<div className="mx-auto grid w-full max-w-6xl gap-2">
					<h1 className="text-3xl font-semibold">Schedule</h1>
				</div>
				<div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
					<ScheduleSubNav />
					<Outlet />
				</div>
			</main>
		</div>
	)
}
