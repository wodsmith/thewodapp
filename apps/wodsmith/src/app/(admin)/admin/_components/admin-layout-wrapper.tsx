"use client"

import { usePathname } from "next/navigation"
import { AdminSidebar } from "./admin-sidebar"

interface AdminLayoutWrapperProps {
	children: React.ReactNode
}

export function AdminLayoutWrapper({ children }: AdminLayoutWrapperProps) {
	const pathname = usePathname()

	// Check if this is a team-specific route (which has its own layout)
	// Pattern: /admin/teams/[teamId] (but not /admin/teams without id)
	const isTeamSpecificRoute = /^\/admin\/teams\/[^/]+/.test(pathname)

	if (isTeamSpecificRoute) {
		// Team-specific routes have their own layout with team sidebar
		return <>{children}</>
	}

	// Non-team-specific routes use the regular admin layout with sidebar
	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
			<aside className="lg:w-1/5">
				<AdminSidebar />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
