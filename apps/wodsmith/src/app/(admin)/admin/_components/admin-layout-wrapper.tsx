"use client"

import { usePathname } from "next/navigation"

interface AdminLayoutWrapperProps {
	children: React.ReactNode
}

export function AdminLayoutWrapper({ children }: AdminLayoutWrapperProps) {
	const pathname = usePathname()

	// Check if this is a site-wide admin page (no team context needed)
	const isSiteWideAdminPage =
		pathname === "/admin" ||
		pathname === "/admin/entitlements" ||
		pathname.startsWith("/admin/entitlements/")

	if (isSiteWideAdminPage) {
		// Site-wide admin pages don't need sidebar
		return <div className="flex-1">{children}</div>
	}

	// All other admin routes (including /admin/teams/*) have their own layout with sidebar
	return <>{children}</>
}
