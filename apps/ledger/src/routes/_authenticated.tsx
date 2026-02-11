import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { checkAuthFn } from "@/server-fns/auth"

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const isAuthenticated = await checkAuthFn()
		if (!isAuthenticated) {
			throw redirect({ to: "/" })
		}
	},
	component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
	return <Outlet />
}
