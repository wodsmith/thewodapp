import MainNav from "@/components/nav/main-nav"
import { AdminLayoutWrapper } from "./_components/admin-layout-wrapper"

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
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
