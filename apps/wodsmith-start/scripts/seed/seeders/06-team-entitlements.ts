import type { Connection } from "mysql2/promise"
import { batchInsert, currentTimestamp, futureUnix, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding team entitlements...")

	const ts = now()
	const cts = currentTimestamp()
	const nextMonth = futureUnix(30)

	// Team subscriptions
	await batchInsert(client, "team_subscriptions", [
		{ id: "tsub_box1", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", plan_id: "pro", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_homegym", team_id: "team_homeymgym", plan_id: "enterprise", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_personaladmin", team_id: "team_personaladmin", plan_id: "free", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_personalcoach", team_id: "team_personalcoach", plan_id: "free", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_personaljohn", team_id: "team_personaljohn", plan_id: "free", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_personaljane", team_id: "team_personaljane", plan_id: "free", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tsub_crossfit", team_id: "team_cokkpu1klwo0ulfhl1iwzpvn", plan_id: "free", status: "active", current_period_start: ts, current_period_end: nextMonth, cancel_at_period_end: 0, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Team feature entitlements
	function tfe(id: string, teamId: string, featureId: string, planId: string) {
		return { id, team_id: teamId, feature_id: featureId, source: "plan", source_plan_id: planId, created_at: cts, updated_at: cts, update_counter: 0 }
	}

	await batchInsert(client, "team_feature_entitlements", [
		// CrossFit Box One (Pro)
		tfe("tfe_box1_basic", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_basic_workouts", "pro"),
		tfe("tfe_box1_tracks", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_programming_tracks", "pro"),
		tfe("tfe_box1_calendar", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_program_calendar", "pro"),
		tfe("tfe_box1_scaling", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_custom_scaling_groups", "pro"),
		tfe("tfe_box1_ai_workout", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_ai_workout_generation", "pro"),
		tfe("tfe_box1_multi_team", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_multi_team_management", "pro"),
		tfe("tfe_box1_host_comp", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "feat_host_competitions", "pro"),
		// Winter Throwdown (inherits Pro)
		tfe("tfe_winter_basic", "team_winter_throwdown_2025", "feat_basic_workouts", "pro"),
		tfe("tfe_winter_tracks", "team_winter_throwdown_2025", "feat_programming_tracks", "pro"),
		tfe("tfe_winter_calendar", "team_winter_throwdown_2025", "feat_program_calendar", "pro"),
		tfe("tfe_winter_scaling", "team_winter_throwdown_2025", "feat_custom_scaling_groups", "pro"),
		tfe("tfe_winter_ai_workout", "team_winter_throwdown_2025", "feat_ai_workout_generation", "pro"),
		tfe("tfe_winter_multi_team", "team_winter_throwdown_2025", "feat_multi_team_management", "pro"),
		tfe("tfe_winter_host_comp", "team_winter_throwdown_2025", "feat_host_competitions", "pro"),
		// Home Gym Heroes (Enterprise)
		tfe("tfe_hgh_basic", "team_homeymgym", "feat_basic_workouts", "enterprise"),
		tfe("tfe_hgh_tracks", "team_homeymgym", "feat_programming_tracks", "enterprise"),
		tfe("tfe_hgh_calendar", "team_homeymgym", "feat_program_calendar", "enterprise"),
		tfe("tfe_hgh_analytics", "team_homeymgym", "feat_program_analytics", "enterprise"),
		tfe("tfe_hgh_scaling", "team_homeymgym", "feat_custom_scaling_groups", "enterprise"),
		tfe("tfe_hgh_ai_workout", "team_homeymgym", "feat_ai_workout_generation", "enterprise"),
		tfe("tfe_hgh_ai_prog", "team_homeymgym", "feat_ai_programming_assistant", "enterprise"),
		tfe("tfe_hgh_multi_team", "team_homeymgym", "feat_multi_team_management", "enterprise"),
		// Personal Teams (Free)
		tfe("tfe_padmin_basic", "team_personaladmin", "feat_basic_workouts", "free"),
		tfe("tfe_padmin_tracks", "team_personaladmin", "feat_programming_tracks", "free"),
		tfe("tfe_pcoach_basic", "team_personalcoach", "feat_basic_workouts", "free"),
		tfe("tfe_pcoach_tracks", "team_personalcoach", "feat_programming_tracks", "free"),
		tfe("tfe_pjohn_basic", "team_personaljohn", "feat_basic_workouts", "free"),
		tfe("tfe_pjohn_tracks", "team_personaljohn", "feat_programming_tracks", "free"),
		tfe("tfe_pjane_basic", "team_personaljane", "feat_basic_workouts", "free"),
		tfe("tfe_pjane_tracks", "team_personaljane", "feat_programming_tracks", "free"),
	])

	// Team limit entitlements
	function tle(id: string, teamId: string, limitId: string, value: number, planId: string) {
		return { id, team_id: teamId, limit_id: limitId, value, source: "plan", source_plan_id: planId, created_at: cts, updated_at: cts, update_counter: 0 }
	}

	await batchInsert(client, "team_limit_entitlements", [
		// CrossFit Box One (Pro)
		tle("tle_box1_members", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "lmt_max_members_per_team", 25, "pro"),
		tle("tle_box1_tracks", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "lmt_max_programming_tracks", -1, "pro"),
		tle("tle_box1_ai", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "lmt_ai_messages_per_month", 200, "pro"),
		tle("tle_box1_admins", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "lmt_max_admins", 5, "pro"),
		// Home Gym Heroes (Enterprise)
		tle("tle_hgh_members", "team_homeymgym", "lmt_max_members_per_team", -1, "enterprise"),
		tle("tle_hgh_tracks", "team_homeymgym", "lmt_max_programming_tracks", -1, "enterprise"),
		tle("tle_hgh_ai", "team_homeymgym", "lmt_ai_messages_per_month", -1, "enterprise"),
		tle("tle_hgh_admins", "team_homeymgym", "lmt_max_admins", -1, "enterprise"),
		// Personal Teams (Free)
		tle("tle_padmin_members", "team_personaladmin", "lmt_max_members_per_team", 1, "free"),
		tle("tle_padmin_tracks", "team_personaladmin", "lmt_max_programming_tracks", 2, "free"),
		tle("tle_padmin_ai", "team_personaladmin", "lmt_ai_messages_per_month", 10, "free"),
		tle("tle_padmin_admins", "team_personaladmin", "lmt_max_admins", 1, "free"),
		tle("tle_pcoach_members", "team_personalcoach", "lmt_max_members_per_team", 1, "free"),
		tle("tle_pcoach_tracks", "team_personalcoach", "lmt_max_programming_tracks", 2, "free"),
		tle("tle_pcoach_ai", "team_personalcoach", "lmt_ai_messages_per_month", 10, "free"),
		tle("tle_pcoach_admins", "team_personalcoach", "lmt_max_admins", 1, "free"),
		tle("tle_pjohn_members", "team_personaljohn", "lmt_max_members_per_team", 1, "free"),
		tle("tle_pjohn_tracks", "team_personaljohn", "lmt_max_programming_tracks", 2, "free"),
		tle("tle_pjohn_ai", "team_personaljohn", "lmt_ai_messages_per_month", 10, "free"),
		tle("tle_pjohn_admins", "team_personaljohn", "lmt_max_admins", 1, "free"),
		tle("tle_pjane_members", "team_personaljane", "lmt_max_members_per_team", 1, "free"),
		tle("tle_pjane_tracks", "team_personaljane", "lmt_max_programming_tracks", 2, "free"),
		tle("tle_pjane_ai", "team_personaljane", "lmt_ai_messages_per_month", 10, "free"),
		tle("tle_pjane_admins", "team_personaljane", "lmt_max_admins", 1, "free"),
	])

	// Team usage tracking
	await batchInsert(client, "team_usages", [
		{ id: "tusage_box1_ai", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", limit_key: "ai_messages_per_month", current_value: 0, period_start: ts, period_end: nextMonth, created_at: cts, updated_at: cts, update_counter: 0 },
		{ id: "tusage_hgh_ai", team_id: "team_homeymgym", limit_key: "ai_messages_per_month", current_value: 0, period_start: ts, period_end: nextMonth, created_at: cts, updated_at: cts, update_counter: 0 },
	])
}
