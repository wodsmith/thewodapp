import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionFromCookie } from "@/utils/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
	children,
}: { children: React.ReactNode }) {
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
