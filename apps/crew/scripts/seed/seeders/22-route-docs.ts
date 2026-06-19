import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

/**
 * Seed starter documentation for the organizer docs drawer.
 *
 * Creates published docs mapped to TanStack Router route IDs so the
 * floating "Docs" button appears on key organizer pages in dev:
 * - A markdown setup guide on the competition layout (inherits to all
 *   competition pages)
 * - Link docs pointing at the docs.wodsmith.com organizer guides for
 *   page-specific help
 */
export async function seed(client: Connection): Promise<void> {
	console.log("Seeding route docs...")

	const ts = now()
	const common = {
		created_at: ts,
		updated_at: ts,
		update_counter: 0,
	}

	await batchInsert(client, "route_docs", [
		{
			id: "rdoc_seed_comp_setup",
			title: "Competition setup guide",
			description: "The big-picture flow for getting a competition live",
			type: "markdown",
			content: [
				"## From draft to race day",
				"",
				"1. **Edit** — name, dates, registration window, timezone",
				"2. **Divisions** — who can register and at what skill level",
				"3. **Events** — the workouts athletes will compete in",
				"4. **Pricing** — registration fees per division",
				"5. **Publish** — flip the competition live when ready",
				"",
				"Heats, volunteers, and results unlock as athletes register.",
				"",
				"Full walkthrough: [Your first competition](https://docs.wodsmith.com/tutorials/organizers/first-competition)",
			].join("\n"),
			video_url: null,
			link_url: null,
			is_published: 1,
			sort_order: 100,
			...common,
		},
		{
			id: "rdoc_seed_schedule_heats",
			title: "Scheduling heats",
			description: "Build venues, heats, and lane assignments",
			type: "link",
			content: null,
			video_url: null,
			link_url: "https://docs.wodsmith.com/how-to/organizers/schedule-heats",
			is_published: 1,
			sort_order: 1,
			...common,
		},
		{
			id: "rdoc_seed_manage_regs",
			title: "Managing registrations",
			description: "Approve, edit, refund, and transfer athlete registrations",
			type: "link",
			content: null,
			video_url: null,
			link_url:
				"https://docs.wodsmith.com/how-to/organizers/manage-registrations",
			is_published: 1,
			sort_order: 1,
			...common,
		},
		{
			id: "rdoc_seed_broadcasts",
			title: "Sending broadcasts",
			description: "Email your athletes before and during the competition",
			type: "link",
			content: null,
			video_url: null,
			link_url: "https://docs.wodsmith.com/how-to/organizers/send-broadcasts",
			is_published: 1,
			sort_order: 1,
			...common,
		},
		{
			id: "rdoc_seed_edit_comp",
			title: "Editing competition details",
			description: "Dates, registration window, description, and visibility",
			type: "link",
			content: null,
			video_url: null,
			link_url: "https://docs.wodsmith.com/how-to/organizers/edit-competition",
			is_published: 1,
			sort_order: 1,
			...common,
		},
		{
			id: "rdoc_seed_first_comp",
			title: "Your first competition",
			description: "End-to-end tutorial from creation to results",
			type: "link",
			content: null,
			video_url: null,
			link_url:
				"https://docs.wodsmith.com/tutorials/organizers/first-competition",
			is_published: 1,
			sort_order: 1,
			...common,
		},
	])

	// Route IDs must match TanStack Router's useMatches() routeId values —
	// index routes end with "/", layout routes don't.
	await batchInsert(client, "route_doc_routes", [
		{
			id: "rdocrt_seed_comp_setup",
			doc_id: "rdoc_seed_comp_setup",
			route_id: "/compete/organizer/$competitionId",
			...common,
		},
		{
			id: "rdocrt_seed_schedule_heats",
			doc_id: "rdoc_seed_schedule_heats",
			route_id: "/compete/organizer/$competitionId/schedule",
			...common,
		},
		{
			id: "rdocrt_seed_manage_regs",
			doc_id: "rdoc_seed_manage_regs",
			route_id: "/compete/organizer/$competitionId/athletes/",
			...common,
		},
		{
			id: "rdocrt_seed_broadcasts",
			doc_id: "rdoc_seed_broadcasts",
			route_id: "/compete/organizer/$competitionId/broadcasts",
			...common,
		},
		{
			id: "rdocrt_seed_edit_comp",
			doc_id: "rdoc_seed_edit_comp",
			route_id: "/compete/organizer/$competitionId/edit",
			...common,
		},
		{
			id: "rdocrt_seed_first_comp",
			doc_id: "rdoc_seed_first_comp",
			route_id: "/compete/organizer/_dashboard/",
			...common,
		},
	])
}
