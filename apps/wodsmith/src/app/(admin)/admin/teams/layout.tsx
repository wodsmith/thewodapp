import { getAdminTeamContext } from "./_utils/get-team-context"
import { AdminSidebar } from "../_components/admin-sidebar"

export default async function TeamAdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const { teamId } = await getAdminTeamContext()

	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 bg-background dark:bg-dark-background">
			<aside className="lg:w-64 lg:flex-shrink-0 overflow-visible">
				<AdminSidebar currentTeamId={teamId} />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
