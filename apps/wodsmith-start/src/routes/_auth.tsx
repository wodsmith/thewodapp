import { createFileRoute, Outlet } from "@tanstack/react-router"
import { getConfig } from "@/flags"

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async () => {
		const config = await getConfig()
		return { config }
	},
})

function AuthLayout() {
	return (
		<div className="min-h-screen bg-background">
			{/* TODO: Add navigation header if needed */}
			<main>
				<Outlet />
			</main>
			{/* TODO: Add footer if needed */}
		</div>
	)
}
