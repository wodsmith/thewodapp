import { AdminSidebar } from "../_components/admin-sidebar"
import { getAdminTeamContext } from "./_utils/get-team-context"

export default async function TeamAdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
	// Validate team context exists (redirects if not authenticated)
	await getAdminTeamContext()

	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 bg-background dark:bg-dark-background">
			<aside className="lg:w-64 lg:flex-shrink-0 overflow-visible">
				<AdminSidebar />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
