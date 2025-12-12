import { createFileRoute, redirect, Outlet } from "@tanstack/react-router"
import { getSessionFromCookie } from "~/utils/auth.server"
import { ROLES_ENUM } from "~/db/schemas/users.server"

export const Route = createFileRoute("/_admin")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session?.user || session.user.role !== ROLES_ENUM.ADMIN) {
			throw redirect({ to: "/" })
		}
	},
	component: AdminLayout,
})

function AdminLayout() {
	return <Outlet />
}
