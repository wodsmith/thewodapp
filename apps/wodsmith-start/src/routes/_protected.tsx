import { createFileRoute, Outlet } from "@tanstack/react-router"
import { validateSession } from "@/server-fns/middleware/auth"

export const Route = createFileRoute("/_protected")({
	beforeLoad: async (opts) => {
		// Validate session on server before rendering protected routes
		const session = await validateSession()
		// Read hasWorkoutTracking from parent context
		const hasWorkoutTracking = opts.context.hasWorkoutTracking
		return { session, hasWorkoutTracking }
	},
	component: ProtectedLayout,
})

function ProtectedLayout() {
	return (
		<div className="min-h-screen bg-background">
			<main>
				<Outlet />
			</main>
		</div>
	)
}
