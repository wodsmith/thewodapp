"use client"

import { Link, useLocation } from "@tanstack/react-router"
import { Calendar, Lock, LogOut, Smartphone, User, Users } from "lucide-react"
import { useRef } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/utils/cn"

interface SidebarNavItem {
	title: string
	href: string
	icon: React.ComponentType<{ className?: string }>
}

const sidebarNavItems: SidebarNavItem[] = [
	{
		title: "Profile",
		href: "/settings/profile",
		icon: User,
	},
	{
		title: "Teams",
		href: "/settings/teams",
		icon: Users,
	},
	{
		title: "Security",
		href: "/settings/security",
		icon: Lock,
	},
	{
		title: "Sessions",
		href: "/settings/sessions",
		icon: Smartphone,
	},
	{
		title: "Programming",
		href: "/settings/programming",
		icon: Calendar,
	},
	{
		title: "Change Password",
		href: "/forgot-password",
		icon: Lock,
	},
]

interface SettingsSidebarProps {
	hasWorkoutTracking?: boolean
}

export function SettingsSidebar({ hasWorkoutTracking }: SettingsSidebarProps) {
	const location = useLocation()
	const pathname = location.pathname
	const dialogCloseRef = useRef<HTMLButtonElement>(null)

	const filteredNavItems = hasWorkoutTracking
		? sidebarNavItems
		: sidebarNavItems.filter((item) => item.title !== "Programming")

	const handleSignOut = async () => {
		// Navigate to sign-out which triggers full page reload
		window.location.href = "/api/auth/sign-out"
	}

	return (
		<div className="w-full lg:w-auto whitespace-nowrap pb-2 overflow-x-auto">
			<nav className="flex items-center lg:items-stretch min-w-full space-x-2 pb-2 lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1">
				{filteredNavItems.map((item) => (
					<Link
						key={item.href}
						to={item.href}
						className={cn(
							buttonVariants({ variant: "ghost" }),
							pathname.startsWith(item.href)
								? "bg-muted hover:bg-muted dark:text-foreground dark:hover:text-foreground/70"
								: "hover:bg-transparent",
							"justify-start hover:no-underline whitespace-nowrap",
						)}
					>
						<item.icon className="mr-2 h-4 w-4" />
						{item.title}
					</Link>
				))}

				<Dialog>
					<DialogTrigger asChild>
						<button
							type="button"
							className={cn(
								buttonVariants({ variant: "destructive" }),
								"justify-start hover:no-underline whitespace-nowrap lg:mt-4 bg-red-700/25 hover:bg-red-600/40",
							)}
						>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Sign out?</DialogTitle>
							<DialogDescription>
								Are you sure you want to sign out of your account?
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="mt-4 flex flex-col gap-4">
							<DialogClose ref={dialogCloseRef} asChild>
								<Button variant="outline">Cancel</Button>
							</DialogClose>
							<Button
								variant="destructive"
								onClick={() => {
									handleSignOut()
									dialogCloseRef.current?.click()
								}}
							>
								Sign out
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</nav>
		</div>
	)
}
