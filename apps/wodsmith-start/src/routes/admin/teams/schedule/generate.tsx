/**
 * Admin Teams Schedule Generate Route
 *
 * Page for generating AI-powered schedules.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/teams/schedule/generate")({
	beforeLoad: () => {
		// TODO: Implement schedule generation UI
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
