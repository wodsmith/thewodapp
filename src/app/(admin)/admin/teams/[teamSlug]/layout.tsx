import { AdminSidebar } from "../../_components/admin-sidebar"

interface TeamAdminLayoutProps {
	children: React.ReactNode
	params: Promise<{
		teamSlug: string
	}>
}

export default async function TeamAdminLayout({
	children,
	params,
}: TeamAdminLayoutProps) {
	const { teamSlug } = await params

	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
			<aside className="">
				<AdminSidebar currentTeamSlug={teamSlug} />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
