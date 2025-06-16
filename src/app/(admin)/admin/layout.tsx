import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireAdminForTeam } from "@/utils/auth"
import { redirect } from "next/navigation"
import { AdminSidebar } from "./_components/admin-sidebar"

export default async function DashboardLayout({
	children,
	params,
}: {
	children: React.ReactNode
	params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	return (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset className="w-full flex flex-col">{children}</SidebarInset>
		</SidebarProvider>
	)
}
