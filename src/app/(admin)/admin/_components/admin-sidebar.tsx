"use client"

import { ScrollShadow } from "@heroui/react"
import { Building2, Shield } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"

interface AdminNavItem {
	title: string
	href: Route
	icon: React.ComponentType<{ className?: string }>
}

const adminNavItems: AdminNavItem[] = [
	{
		title: "Team Management",
		href: "/admin/teams",
		icon: Building2,
	},
]

export function AdminSidebar() {
	const pathname = usePathname()
	const isLgAndSmaller = useMediaQuery("LG_AND_SMALLER")

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary">
				<Shield className="h-6 w-6" />
				<span className="text-lg font-mono font-bold">Admin Panel</span>
			</div>

			{/* Navigation */}
			<ScrollShadow
				className="w-full lg:w-auto whitespace-nowrap pb-2"
				orientation="horizontal"
				isEnabled={isLgAndSmaller}
			>
				<nav className="flex items-center lg:items-stretch min-w-full space-x-2 pb-2 lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1">
					{adminNavItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								buttonVariants({ variant: "ghost" }),
								pathname.startsWith(item.href)
									? "bg-orange text-white hover:bg-orange-600 border-2 border-primary shadow-[2px_2px_0px_0px] shadow-primary font-mono"
									: "hover:bg-orange hover:text-white border-2 border-transparent hover:border-primary hover:shadow-[2px_2px_0px_0px] hover:shadow-primary font-mono",
								"justify-start hover:no-underline whitespace-nowrap",
							)}
						>
							<item.icon className="mr-2 h-4 w-4" />
							{item.title}
						</Link>
					))}
				</nav>
			</ScrollShadow>
		</div>
	)
}
