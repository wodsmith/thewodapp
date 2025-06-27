import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionFromCookie } from "@/utils/auth"

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const session = await getSessionFromCookie()

	if (!session) {
		return redirect("/")
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	)
}
