import MainNav from "@/components/nav/main-nav"
import { AdminSidebar } from "./_components/admin-sidebar"

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<div className="sm:h-screen">
			<MainNav />
			<div className="flex flex-col max-w-screen-xl mx-auto">
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
						<aside className="lg:w-1/5">
							<AdminSidebar />
						</aside>
						<div className="flex-1">{children}</div>
					</div>
				</div>
			</div>
		</div>
	)
}
