import type { Client } from "@planetscale/database"

/**
 * Delete all rows from all tables in reverse dependency order.
 * Matches the cleanup section from seed.sql but uses MySQL table names.
 */
export async function cleanup(client: Client): Promise<void> {
	const tables = [
		// Competition deep children
		"score_rounds",
		"scores",
		"judge_heat_assignments",
		"judge_assignment_versions",
		"competition_judge_rotations",
		"video_submissions",
		"submission_window_notifications",
		"event_judging_sheets",
		"event_resources",
		"competition_events",
		"competition_heat_assignments",
		"competition_heats",
		"competition_registration_answers",
		"competition_registration_questions",
		"competition_registrations",
		"competition_venues",
		"competition_divisions",
		"competitions",
		"competition_groups",
		"addresses",
		// Scheduling
		"scheduled_classes",
		"generated_schedules",
		"schedule_template_class_required_skills",
		"schedule_template_classes",
		"schedule_templates",
		// Programming
		"scheduled_workout_instances",
		"team_programming_tracks",
		"track_workouts",
		"programming_tracks",
		// Workouts and related
		"sets",
		"results",
		"workout_scaling_descriptions",
		"workout_movements",
		"workout_tags",
		"workouts",
		"spicy_tags",
		"movements",
		// Scaling
		"scaling_levels",
		"scaling_groups",
		// Coaches / Classes
		"coach_to_skills",
		"class_catalog_to_skills",
		"coach_blackout_dates",
		"coach_recurring_unavailability",
		"coaches",
		"class_catalogs",
		"skills",
		"locations",
		// Sponsors
		"sponsors",
		"sponsor_groups",
		// Commerce
		"purchased_items",
		"credit_transactions",
		"commerce_purchases",
		"commerce_products",
		// Auth
		"passkey_credentials",
		"waiver_signatures",
		"waivers",
		// Team hierarchy (children before parents)
		"affiliates",
		"organizer_requests",
		"team_invitations",
		"team_memberships",
		"team_roles",
		"team_entitlement_overrides",
		"team_feature_entitlements",
		"team_limit_entitlements",
		"team_usages",
		"team_addons",
		"team_subscriptions",
		"entitlements",
		// Plans and features (before teams)
		"plan_limits",
		"plan_features",
		"plans",
		"limits",
		"features",
		"entitlement_types",
		// Core entities
		"teams",
		"users",
	]

	console.log("Cleaning up all tables...")
	for (const table of tables) {
		try {
			await client.execute(`DELETE FROM \`${table}\``)
		} catch {
			// Table might not exist yet, that's OK
		}
	}
	console.log(`  Cleaned ${tables.length} tables\n`)
}
