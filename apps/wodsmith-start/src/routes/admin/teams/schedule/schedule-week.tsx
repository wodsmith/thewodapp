/**
 * Admin Teams Schedule Week Route
 *
 * Page for viewing and managing the weekly schedule.
 * Currently redirects to the main schedule page as this feature is under development.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/teams/schedule/schedule-week")({
	beforeLoad: () => {
		// TODO: Implement weekly schedule view
		// This page shows generated schedules, templates, locations, and coaches
		// For now, redirect to main schedule page
		throw redirect({
			to: "/admin/teams/schedule",
		})
	},
})
