import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

/**
 * Seeds event templates for the MWFC series to test the series event template system.
 *
 * Creates:
 * - A template programming track on the MWFC series
 * - 3 template events (matching the comp events)
 * - Event mappings for 4 of 5 competitions (Phoenix is unmapped — cold start test)
 * - Portland comp has a MISMATCHED event (different name/description) to test sync diff
 * - Division mappings (required for per-division description sync)
 *
 * Test scenarios:
 * - Boise, Salt Lake, Denver: fully mapped + in sync
 * - Portland: mapped but event 2 has different workout details → shows "behind" status
 * - Phoenix: no mappings at all → shows "unmapped" status
 */

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding series event templates for MWFC series...")

	const ts = now()
	const ORGANIZING_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
	const GROUP_ID = "cgrp_seed_mwfc_series"

	// ── Template programming track ──
	await batchInsert(client, "programming_tracks", [
		{
			id: "track_mwfc_template",
			name: "Series Event Template",
			type: "series-template",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: null,
			is_public: 0,
			competition_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ── Template workouts (separate from comp workouts — templates are clones) ──
	await batchInsert(client, "workouts", [
		{
			id: "wod_mwfc_tmpl_e1",
			name: "Throwdown Event 1: Fran",
			description: "21-15-9 Thrusters (95/65) and Pull-ups",
			scheme: "time",
			score_type: "min",
			scope: "private",
			team_id: ORGANIZING_TEAM,
			rounds_to_score: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_mwfc_tmpl_e2",
			name: "Throwdown Event 2: Cindy",
			description: "20 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Squats",
			scheme: "rounds-reps",
			score_type: "max",
			scope: "private",
			team_id: ORGANIZING_TEAM,
			rounds_to_score: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_mwfc_tmpl_e3",
			name: "Throwdown Event 3: Max Clean",
			description: "Find your 1RM Clean & Jerk",
			scheme: "load",
			score_type: "max",
			scope: "private",
			team_id: ORGANIZING_TEAM,
			rounds_to_score: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ── Template track_workouts ──
	await batchInsert(client, "track_workouts", [
		{
			id: "tw_mwfc_tmpl_e1",
			track_id: "track_mwfc_template",
			workout_id: "wod_mwfc_tmpl_e1",
			track_order: 1,
			event_status: "published",
			heat_status: "draft",
			points_multiplier: 100,
			notes: "Standard Fran — enforce strict pull-up standards",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_mwfc_tmpl_e2",
			track_id: "track_mwfc_template",
			workout_id: "wod_mwfc_tmpl_e2",
			track_order: 2,
			event_status: "published",
			heat_status: "draft",
			points_multiplier: 100,
			notes: "20 min cap, count full rounds + reps",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_mwfc_tmpl_e3",
			track_id: "track_mwfc_template",
			workout_id: "wod_mwfc_tmpl_e3",
			track_order: 3,
			event_status: "published",
			heat_status: "draft",
			points_multiplier: 150, // Finals event — 1.5x points
			notes: "Max effort, 3 attempts, must show control at top",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ── Update series group settings with templateTrackId ──
	await client.execute(
		`UPDATE competition_groups SET settings = ? WHERE id = ?`,
		[
			JSON.stringify({ templateTrackId: "track_mwfc_template" }),
			GROUP_ID,
		],
	)
	console.log("  Updated MWFC series settings with templateTrackId")

	// ── Event mappings for 4 of 5 comps (Phoenix unmapped) ──
	const mappedComps = ["a", "b", "c", "d"] // NOT "e" (Phoenix)
	const eventMappings: Array<Record<string, unknown>> = []

	for (const letter of mappedComps) {
		for (let e = 1; e <= 3; e++) {
			eventMappings.push({
				id: `sem_mwfc_${letter}_e${e}`,
				group_id: GROUP_ID,
				competition_id: `comp_mwfc_${letter}`,
				competition_event_id: `tw_mwfc_${letter}_e${e}`,
				template_event_id: `tw_mwfc_tmpl_e${e}`,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "series_event_mappings", eventMappings)

	// ── Make Portland (comp D) event 2 mismatched ──
	// Change the workout name and description so sync preview shows a diff
	await client.execute(
		`UPDATE workouts SET name = ?, description = ? WHERE id = ?`,
		[
			"Throwdown Event 2: Modified Cindy",
			"15 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Air Squats (modified cap)",
			"wod_mwfc_e2", // This is the SHARED workout used by all comps
		],
	)
	console.log("  Mismatched Portland event 2 (different name + description)")

	// Actually, all comps share the same workout ID. Let's give Portland its own workout
	// for event 2 so only Portland is mismatched.
	await batchInsert(client, "workouts", [
		{
			id: "wod_mwfc_d_e2_custom",
			name: "Throwdown Event 2: Modified Cindy",
			description: "15 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Air Squats (modified cap)",
			scheme: "rounds-reps",
			score_type: "max",
			scope: "private",
			team_id: ORGANIZING_TEAM,
			rounds_to_score: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Revert the shared workout
	await client.execute(
		`UPDATE workouts SET name = ?, description = ? WHERE id = ?`,
		[
			"Throwdown Event 2: Cindy",
			"20 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Squats",
			"wod_mwfc_e2",
		],
	)

	// Point Portland's event 2 track_workout to the custom workout
	await client.execute(
		`UPDATE track_workouts SET workout_id = ? WHERE id = ?`,
		["wod_mwfc_d_e2_custom", "tw_mwfc_d_e2"],
	)
	console.log("  Portland event 2 now uses custom workout (diverged from template)")

	// ── Division mappings (needed for per-division description sync) ──
	// Map each comp's divisions to series template divisions
	// We'll use Boise's divisions as the series template (canonical labels)
	// First, create a series scaling group + template divisions
	await batchInsert(client, "scaling_groups", [
		{
			id: "sgrp_mwfc_series_template",
			title: "MWFC Series Template Divisions",
			team_id: ORGANIZING_TEAM,
			is_default: 0,
			is_system: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "scaling_levels", [
		{ id: "slvl_mwfc_series_mrx", scaling_group_id: "sgrp_mwfc_series_template", label: "Men's Individual RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_series_wrx", scaling_group_id: "sgrp_mwfc_series_template", label: "Women's Individual RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_series_sc", scaling_group_id: "sgrp_mwfc_series_template", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "series_template_divisions", [
		{ id: "std_mwfc_mrx", group_id: GROUP_ID, division_id: "slvl_mwfc_series_mrx", fee_cents: 7500, description: "Men's Individual RX division", max_spots: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "std_mwfc_wrx", group_id: GROUP_ID, division_id: "slvl_mwfc_series_wrx", fee_cents: 7500, description: "Women's Individual RX division", max_spots: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "std_mwfc_sc", group_id: GROUP_ID, division_id: "slvl_mwfc_series_sc", fee_cents: 5000, description: "Scaled division", max_spots: null, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Update series settings with scalingGroupId too
	await client.execute(
		`UPDATE competition_groups SET settings = ? WHERE id = ?`,
		[
			JSON.stringify({
				templateTrackId: "track_mwfc_template",
				scalingGroupId: "sgrp_mwfc_series_template",
			}),
			GROUP_ID,
		],
	)

	// Division mappings for all 5 comps
	const divMappings: Array<Record<string, unknown>> = []
	const divSuffixes = ["mrx", "wrx", "sc"]
	for (const letter of ["a", "b", "c", "d", "e"]) {
		for (const suffix of divSuffixes) {
			divMappings.push({
				id: `sdm_mwfc_${letter}_${suffix}`,
				group_id: GROUP_ID,
				competition_id: `comp_mwfc_${letter}`,
				competition_division_id: `slvl_mwfc_${letter}_${suffix}`,
				series_division_id: `slvl_mwfc_series_${suffix}`,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "series_division_mappings", divMappings)

	console.log(`
MWFC Series Event Template seeded:
  Template track: track_mwfc_template (3 events)
  Mapped comps: Boise, Salt Lake, Denver, Portland (4/5)
  Unmapped comp: Phoenix (test unmapped status)
  Mismatched: Portland event 2 has different workout name/description
  Division template: 3 divisions (Men's RX, Women's RX, Scaled)
  Division mappings: all 5 comps mapped

Test scenarios:
  • Boise/Salt Lake/Denver: should show "in-sync" status
  • Portland: should show "behind" (event 2 differs from template)
  • Phoenix: should show "unmapped" (no event mappings)
  • Sync Portland → should preview "name changed, description changed" for event 2
  • Sync Phoenix → should create all 3 events as new
`)
}
