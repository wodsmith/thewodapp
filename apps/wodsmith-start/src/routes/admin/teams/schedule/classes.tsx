/**
 * Admin Teams Schedule Classes Route
 *
 * Page for managing the class catalog.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/teams/schedule/classes")({
	beforeLoad: () => {
		// TODO: Implement class catalog management UI
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
