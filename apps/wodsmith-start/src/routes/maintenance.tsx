import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/maintenance")({
	component: MaintenancePage,
})

function MaintenancePage() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold">Scheduled Maintenance</h1>
				<p className="mt-4 text-muted-foreground">
					We're performing scheduled maintenance. Please check back in a few
					minutes.
				</p>
			</div>
		</div>
	)
}
