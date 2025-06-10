import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireAdmin } from "@/utils/auth"
import { redirect } from "next/navigation"
import { AdminSidebar } from "./_components/admin-sidebar"

export default async function DashboardLayout({
	children,
}: { children: React.ReactNode }) {
	const session = await requireAdmin({ doNotThrowError: true })

	if (!session) {
		return redirect("/")
	}

	return (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset className="w-full flex flex-col">{children}</SidebarInset>
		</SidebarProvider>
	)
}
