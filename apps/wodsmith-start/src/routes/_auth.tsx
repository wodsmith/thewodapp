import { createFileRoute, Outlet } from "@tanstack/react-router"
import { MainNav } from "~/components/nav/main-nav"
import { Footer } from "~/components/footer"

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
})

function AuthLayout() {
	return (
		<div className="min-h-screen flex flex-col">
			<MainNav />
			<main className="flex-1">
				<Outlet />
			</main>
			<Footer />
		</div>
	)
}
