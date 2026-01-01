/**
 * Admin Teams Schedule Templates Route
 *
 * Page for managing schedule templates.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute(
	"/admin/teams/schedule/schedule-templates",
)({
	beforeLoad: () => {
		// TODO: Implement schedule templates management
		// This page manages templates, class catalog, locations, and skills
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
