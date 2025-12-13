import { redirect } from "next/navigation"
import MainNav from "@/components/nav/main-nav"
import { getSessionFromCookie } from "@/utils/auth"
import { AdminLayoutWrapper } from "./_components/admin-layout-wrapper"

/**
 * Admin layout with authentication.
 *
 * Auth flow:
 * - Not logged in → redirect to /sign-in
 * - Site-wide admin pages (/, /entitlements, /organizer-requests) → require ADMIN role via requireAdmin() in each page
 * - Team admin pages (/teams/*) → team auth handled in teams/layout.tsx via getAdminTeamContext()
 */
export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const session = await getSessionFromCookie()

	// Not logged in → redirect to sign-in
	if (!session?.userId) {
		redirect("/sign-in")
	}

	return (
		<div className="sm:h-screen">
			<MainNav />
			<div className="flex flex-col">
				<div className="mx-auto w-full max-w-7xl flex flex-1 flex-col gap-4 p-4 pt-0">
					<AdminLayoutWrapper>{children}</AdminLayoutWrapper>
				</div>
			</div>
		</div>
	)
}
