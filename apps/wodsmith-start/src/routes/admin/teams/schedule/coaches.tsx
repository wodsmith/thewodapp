/**
 * Admin Teams Schedule Coaches Route
 *
 * Page for managing coach availability and assignments.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/teams/schedule/coaches")({
	beforeLoad: () => {
		// TODO: Implement coach management UI
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
