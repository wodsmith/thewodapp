/**
 * Admin Teams Schedule Gym Setup Route
 *
 * Page for configuring gym settings, locations, and equipment.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/teams/schedule/gym-setup")({
	beforeLoad: () => {
		// TODO: Implement gym setup UI
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
