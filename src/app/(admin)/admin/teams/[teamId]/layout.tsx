import { AdminSidebar } from "../../_components/admin-sidebar"

interface TeamAdminLayoutProps {
	children: React.ReactNode
	params: Promise<{
		teamId: string
	}>
}

export default async function TeamAdminLayout({
	children,
	params,
}: TeamAdminLayoutProps) {
	const { teamId } = await params

	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
			<aside className="">
				<AdminSidebar currentTeamId={teamId} />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
