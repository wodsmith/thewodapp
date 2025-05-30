import { AdminSidebar } from "./_components/admin-sidebar"
import { requireAdmin } from "@/utils/auth"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin({ doNotThrowError: true })

  if (!session) {
    return redirect('/')
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="w-full flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
