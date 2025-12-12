"use client"

import { Link, useLocation } from "@tanstack/react-router"
import { cn } from "~/lib/utils"

interface SettingsSidebarProps {
	className?: string
}

const settingsNavItems = [
	{ label: "Profile", href: "/settings/profile" },
	{ label: "Account", href: "/settings/account" },
	{ label: "Security", href: "/settings/security" },
	{ label: "Notifications", href: "/settings/notifications" },
	{ label: "Teams", href: "/settings/teams" },
]

export function SettingsSidebar({ className }: SettingsSidebarProps) {
	const location = useLocation()

	return (
		<nav className={cn("space-y-1", className)}>
			{settingsNavItems.map((item) => {
				const isActive = location.pathname === item.href
				return (
					<Link
						key={item.href}
						to={item.href}
						className={cn(
							"block px-3 py-2 rounded-md text-sm font-medium transition-colors",
							isActive
								? "bg-primary text-primary-foreground"
								: "hover:bg-muted"
						)}
					>
						{item.label}
					</Link>
				)
			})}
		</nav>
	)
}
