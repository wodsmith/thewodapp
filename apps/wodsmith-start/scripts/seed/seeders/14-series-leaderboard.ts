import type { Connection } from "mysql2/promise"
import { batchInsert, now, pastDate } from "../helpers"
import {
	computeSortKey,
	sortKeyToString,
} from "../../../src/lib/scoring/sort/sort-key"
import { encodeRoundsRepsFromParts } from "../../../src/lib/scoring/encode/rounds-reps"
import { encodeLoadFromNumber } from "../../../src/lib/scoring/encode/load"

/**
 * Seeds two series to test the division mapping system:
 *
 * SERIES 1 — "2026 Mountain West Throwdown Series" (MWFC-like)
 *   Simulates the real-world problem: 5 competitions, each with its OWN
 *   scaling group (just like prod where initializeCompetitionDivisionsFn
 *   always creates a fresh group). Division labels vary slightly across comps.
 *   The organizer must:
 *   1. Pick one comp as the template
 *   2. Auto-map the rest (fuzzy matching handles label variations)
 *   3. Manually fix any unmapped divisions
 *   4. Save → leaderboard works
 *
 * SERIES 2 — "2026 Summer Showdown" (fresh/empty)
 *   Has 2 competitions but no template configured yet.
 *   The organizer must create a template from scratch.
 */

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding series leaderboard data (MWFC-like + fresh)...")

	const ts = now()
	const ORGANIZING_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"

	// ═════════════════════════════════════════════════════════════════
	// SERIES 1: Mountain West Throwdown Series (existing, needs mapping)
	// ═════════════════════════════════════════════════════════════════

	await batchInsert(client, "competition_groups", [
		{
			id: "cgrp_seed_mwfc_series",
			organizing_team_id: ORGANIZING_TEAM,
			slug: "2026-mountain-west-throwdowns",
			name: "2026 Mountain West Throwdown Series",
			description: "Five throwdowns across the Mountain West. Each gym ran their own divisions — now we need a global leaderboard.",
			// No settings.scalingGroupId — template not configured yet
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ── 5 separate scaling groups (one per comp, like prod) ──
	// Labels vary across gyms to exercise fuzzy matching:
	// - "Men's Individual RX" vs "Mens RX" vs "Men's RX (Indy)"
	// - "Women's Individual RX" vs "Womens RX" vs "Women's RX"
	// - "Scaled" is consistent
	// - Comp E has an extra "Masters 40+" division (partial mapping)

	await batchInsert(client, "scaling_groups", [
		{ id: "sgrp_mwfc_a", title: "Boise Throwdown Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_mwfc_b", title: "Salt Lake Throwdown Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_mwfc_c", title: "Denver Throwdown Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_mwfc_d", title: "Portland Throwdown Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_mwfc_e", title: "Phoenix Throwdown Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "scaling_levels", [
		// Comp A: Boise — canonical-style labels
		{ id: "slvl_mwfc_a_mrx", scaling_group_id: "sgrp_mwfc_a", label: "Men's Individual RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_a_wrx", scaling_group_id: "sgrp_mwfc_a", label: "Women's Individual RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_a_sc", scaling_group_id: "sgrp_mwfc_a", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },

		// Comp B: Salt Lake — abbreviated labels (no "Individual", no apostrophe)
		{ id: "slvl_mwfc_b_mrx", scaling_group_id: "sgrp_mwfc_b", label: "Mens RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_b_wrx", scaling_group_id: "sgrp_mwfc_b", label: "Womens RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_b_sc", scaling_group_id: "sgrp_mwfc_b", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },

		// Comp C: Denver — parenthesized suffix
		{ id: "slvl_mwfc_c_mrx", scaling_group_id: "sgrp_mwfc_c", label: "Men's RX (Indy)", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_c_wrx", scaling_group_id: "sgrp_mwfc_c", label: "Women's RX (Indy)", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_c_sc", scaling_group_id: "sgrp_mwfc_c", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },

		// Comp D: Portland — same as canonical
		{ id: "slvl_mwfc_d_mrx", scaling_group_id: "sgrp_mwfc_d", label: "Men's Individual RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_d_wrx", scaling_group_id: "sgrp_mwfc_d", label: "Women's Individual RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_d_sc", scaling_group_id: "sgrp_mwfc_d", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },

		// Comp E: Phoenix — has extra Masters 40+ division
		{ id: "slvl_mwfc_e_mrx", scaling_group_id: "sgrp_mwfc_e", label: "Men's Individual RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_e_wrx", scaling_group_id: "sgrp_mwfc_e", label: "Women's Individual RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_e_sc", scaling_group_id: "sgrp_mwfc_e", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_mwfc_e_m40", scaling_group_id: "sgrp_mwfc_e", label: "Masters 40+", position: 3, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// ── Shared workouts (same across all 5 comps) ──
	await batchInsert(client, "workouts", [
		{ id: "wod_mwfc_e1", name: "Throwdown Event 1: Fran", description: "21-15-9 Thrusters and Pull-ups", scheme: "time", score_type: "min", scope: "private", team_id: ORGANIZING_TEAM, rounds_to_score: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wod_mwfc_e2", name: "Throwdown Event 2: Cindy", description: "20 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Squats", scheme: "rounds-reps", score_type: "max", scope: "private", team_id: ORGANIZING_TEAM, rounds_to_score: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wod_mwfc_e3", name: "Throwdown Event 3: Max Clean", description: "Find your 1RM Clean & Jerk", scheme: "load", score_type: "max", scope: "private", team_id: ORGANIZING_TEAM, rounds_to_score: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// ── Competition-event teams ──
	const compTeams = ["a", "b", "c", "d", "e"].map((letter) => ({
		id: `team_mwfc_${letter}`,
		name: `MWFC ${letter.toUpperCase()} Athletes`,
		slug: `mwfc-${letter}-athletes`,
		description: `Athlete team for MWFC throwdown ${letter.toUpperCase()}`,
		type: "competition_event",
		is_personal_team: 0,
		personal_team_owner_id: null,
		current_plan_id: null,
		parent_organization_id: ORGANIZING_TEAM,
		created_at: ts,
		updated_at: ts,
		update_counter: 0,
	}))
	await batchInsert(client, "teams", compTeams)

	// ── Competitions ──
	const compNames: Record<string, string> = {
		a: "Boise Throwdown",
		b: "Salt Lake Throwdown",
		c: "Denver Throwdown",
		d: "Portland Throwdown",
		e: "Phoenix Throwdown",
	}
	const comps = ["a", "b", "c", "d", "e"].map((letter, i) => ({
		id: `comp_mwfc_${letter}`,
		organizing_team_id: ORGANIZING_TEAM,
		competition_team_id: `team_mwfc_${letter}`,
		group_id: "cgrp_seed_mwfc_series",
		slug: `mwfc-2026-${letter}`,
		name: compNames[letter],
		description: `${compNames[letter]} — part of the 2026 Mountain West series.`,
		start_date: pastDate(35 - i * 7),
		end_date: pastDate(34 - i * 7),
		registration_opens_at: pastDate(49 - i * 7),
		registration_closes_at: pastDate(36 - i * 7),
		timezone: "America/Denver",
		settings: `{"divisions": {"scalingGroupId": "sgrp_mwfc_${letter}"}}`,
		default_registration_fee_cents: 7500,
		visibility: "public",
		status: "published",
		competition_type: "in-person",
		created_at: ts,
		updated_at: ts,
		update_counter: 0,
	}))
	await batchInsert(client, "competitions", comps)

	// ── Programming tracks + track workouts ──
	const tracks = ["a", "b", "c", "d", "e"].map((letter) => ({
		id: `track_mwfc_${letter}`,
		name: `${compNames[letter]} Events`,
		type: "team_owned",
		owner_team_id: ORGANIZING_TEAM,
		scaling_group_id: `sgrp_mwfc_${letter}`,
		is_public: 0,
		competition_id: `comp_mwfc_${letter}`,
		created_at: ts,
		updated_at: ts,
		update_counter: 0,
	}))
	await batchInsert(client, "programming_tracks", tracks)

	const trackWorkouts: Array<Record<string, unknown>> = []
	for (const letter of ["a", "b", "c", "d", "e"]) {
		for (let e = 1; e <= 3; e++) {
			trackWorkouts.push({
				id: `tw_mwfc_${letter}_e${e}`,
				track_id: `track_mwfc_${letter}`,
				workout_id: `wod_mwfc_e${e}`,
				track_order: e - 1,
				event_status: "published",
				heat_status: "published",
				points_multiplier: 100,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "track_workouts", trackWorkouts)

	// ── Athlete assignments per comp ──
	// Each comp gets 2 athletes in Men's RX to show cross-comp ranking
	const athleteAssignments: Record<string, Array<{ name: string; userId: string; divisionSuffix: string }>> = {
		a: [
			{ name: "mike", userId: "usr_athlete_mike", divisionSuffix: "mrx" },
			{ name: "sarah", userId: "usr_athlete_sarah", divisionSuffix: "wrx" },
			{ name: "emma", userId: "usr_athlete_emma", divisionSuffix: "sc" },
		],
		b: [
			{ name: "ryan", userId: "usr_athlete_ryan", divisionSuffix: "mrx" },
			{ name: "ashley", userId: "usr_athlete_ashley", divisionSuffix: "wrx" },
			{ name: "brittany", userId: "usr_athlete_brittany", divisionSuffix: "sc" },
		],
		c: [
			{ name: "alex", userId: "usr_athlete_alex", divisionSuffix: "mrx" },
			{ name: "megan", userId: "usr_athlete_megan", divisionSuffix: "wrx" },
			{ name: "stephanie", userId: "usr_athlete_stephanie", divisionSuffix: "sc" },
		],
		d: [
			{ name: "jordan", userId: "usr_athlete_jordan", divisionSuffix: "mrx" },
			{ name: "nicole", userId: "usr_athlete_nicole", divisionSuffix: "wrx" },
			{ name: "lauren", userId: "usr_athlete_lauren", divisionSuffix: "sc" },
		],
		e: [
			{ name: "marcus", userId: "usr_athlete_marcus", divisionSuffix: "mrx" },
			{ name: "kaitlyn", userId: "usr_athlete_kaitlyn", divisionSuffix: "wrx" },
			{ name: "tyler", userId: "usr_athlete_tyler", divisionSuffix: "sc" },
			{ name: "chris", userId: "usr_athlete_chris", divisionSuffix: "m40" }, // Masters 40+ (only in comp E)
		],
	}

	// Team memberships
	const memberships: Array<Record<string, unknown>> = []
	for (const [letter, athletes] of Object.entries(athleteAssignments)) {
		// Admin membership
		memberships.push({
			id: `mbr_mwfc_admin_${letter}`,
			team_id: `team_mwfc_${letter}`,
			user_id: "usr_demo1admin",
			role_id: "member",
			is_system_role: 1,
			joined_at: ts,
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})
		for (const a of athletes) {
			memberships.push({
				id: `mbr_mwfc_${a.name}_${letter}`,
				team_id: `team_mwfc_${letter}`,
				user_id: a.userId,
				role_id: "member",
				is_system_role: 1,
				joined_at: ts,
				is_active: 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "team_memberships", memberships)

	// Registrations
	const registrations: Array<Record<string, unknown>> = []
	for (const [letter, athletes] of Object.entries(athleteAssignments)) {
		for (const a of athletes) {
			registrations.push({
				id: `reg_mwfc_${a.name}_${letter}`,
				event_id: `comp_mwfc_${letter}`,
				user_id: a.userId,
				team_member_id: `mbr_mwfc_${a.name}_${letter}`,
				division_id: `slvl_mwfc_${letter}_${a.divisionSuffix}`,
				registered_at: ts,
				status: "active",
				payment_status: "FREE",
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "competition_registrations", registrations)

	// ── Scores ──
	function sk(value: number, scheme: "time" | "rounds-reps" | "load"): string {
		const scoreType = scheme === "time" ? "min" : "max"
		return sortKeyToString(
			computeSortKey({ value, status: "scored", scheme, scoreType }),
		)
	}

	// Time scores (ms) — spread across all comps
	const e1Times: Record<string, number> = {
		mike: 225000, sarah: 252000, emma: 330000,
		ryan: 210000, ashley: 260000, brittany: 345000,
		alex: 303000, megan: 275000, stephanie: 360000,
		jordan: 235000, nicole: 280000, lauren: 350000,
		marcus: 285000, kaitlyn: 290000, tyler: 375000, chris: 310000,
	}
	// Rounds-reps scores
	const e2Values: Record<string, number> = {
		mike: encodeRoundsRepsFromParts(7, 5) ?? 705,
		sarah: encodeRoundsRepsFromParts(6, 8) ?? 608,
		emma: encodeRoundsRepsFromParts(5, 0) ?? 500,
		ryan: encodeRoundsRepsFromParts(7, 15) ?? 715,
		ashley: encodeRoundsRepsFromParts(6, 2) ?? 602,
		brittany: encodeRoundsRepsFromParts(4, 18) ?? 418,
		alex: encodeRoundsRepsFromParts(5, 10) ?? 510,
		megan: encodeRoundsRepsFromParts(6, 12) ?? 612,
		stephanie: encodeRoundsRepsFromParts(4, 10) ?? 410,
		jordan: encodeRoundsRepsFromParts(6, 18) ?? 618,
		nicole: encodeRoundsRepsFromParts(5, 22) ?? 522,
		lauren: encodeRoundsRepsFromParts(4, 25) ?? 425,
		marcus: encodeRoundsRepsFromParts(5, 20) ?? 520,
		kaitlyn: encodeRoundsRepsFromParts(5, 15) ?? 515,
		tyler: encodeRoundsRepsFromParts(4, 15) ?? 415,
		chris: encodeRoundsRepsFromParts(5, 5) ?? 505,
	}
	// Load scores (lbs → grams)
	const e3Lbs: Record<string, number> = {
		mike: 265, sarah: 175, emma: 135,
		ryan: 275, ashley: 165, brittany: 125,
		alex: 230, megan: 185, stephanie: 130,
		jordan: 270, nicole: 170, lauren: 140,
		marcus: 240, kaitlyn: 160, tyler: 145, chris: 215,
	}
	const e3Grams: Record<string, number> = Object.fromEntries(
		Object.entries(e3Lbs).map(([name, lbs]) => [
			name,
			encodeLoadFromNumber(lbs, "lbs") ?? Math.round(lbs * 453.592),
		]),
	)

	const scores: Array<Record<string, unknown>> = []
	for (const [letter, athletes] of Object.entries(athleteAssignments)) {
		for (const a of athletes) {
			const divisionId = `slvl_mwfc_${letter}_${a.divisionSuffix}`
			// Event 1 — time
			scores.push({
				id: `scr_mwfc_${a.name}_${letter}_e1`,
				user_id: a.userId,
				team_id: ORGANIZING_TEAM,
				workout_id: "wod_mwfc_e1",
				competition_event_id: `tw_mwfc_${letter}_e1`,
				scheme: "time",
				score_type: "min",
				score_value: e1Times[a.name],
				status: "scored",
				status_order: 0,
				sort_key: sk(e1Times[a.name], "time"),
				as_rx: 1,
				scaling_level_id: divisionId,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
			// Event 2 — rounds-reps
			scores.push({
				id: `scr_mwfc_${a.name}_${letter}_e2`,
				user_id: a.userId,
				team_id: ORGANIZING_TEAM,
				workout_id: "wod_mwfc_e2",
				competition_event_id: `tw_mwfc_${letter}_e2`,
				scheme: "rounds-reps",
				score_type: "max",
				score_value: e2Values[a.name],
				status: "scored",
				status_order: 0,
				sort_key: sk(e2Values[a.name], "rounds-reps"),
				as_rx: 1,
				scaling_level_id: divisionId,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
			// Event 3 — load
			scores.push({
				id: `scr_mwfc_${a.name}_${letter}_e3`,
				user_id: a.userId,
				team_id: ORGANIZING_TEAM,
				workout_id: "wod_mwfc_e3",
				competition_event_id: `tw_mwfc_${letter}_e3`,
				scheme: "load",
				score_type: "max",
				score_value: e3Grams[a.name],
				status: "scored",
				status_order: 0,
				sort_key: sk(e3Grams[a.name], "load"),
				as_rx: 1,
				scaling_level_id: divisionId,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}
	await batchInsert(client, "scores", scores)

	// ═════════════════════════════════════════════════════════════════
	// SERIES 2: Summer Showdown (fresh, no template — cold start test)
	// ═════════════════════════════════════════════════════════════════

	await batchInsert(client, "competition_groups", [
		{
			id: "cgrp_seed_summer_showdown",
			organizing_team_id: ORGANIZING_TEAM,
			slug: "2026-summer-showdown",
			name: "2026 Summer Showdown",
			description: "Brand new series — no template configured yet. Use this to test cold-start template creation.",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Two comps with their own scaling groups
	await batchInsert(client, "scaling_groups", [
		{ id: "sgrp_summer_1", title: "Summer Showdown Week 1 Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_summer_2", title: "Summer Showdown Week 2 Divisions", team_id: ORGANIZING_TEAM, is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "scaling_levels", [
		{ id: "slvl_summer_1_rx", scaling_group_id: "sgrp_summer_1", label: "RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_summer_1_sc", scaling_group_id: "sgrp_summer_1", label: "Scaled", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_summer_2_rx", scaling_group_id: "sgrp_summer_2", label: "RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_summer_2_sc", scaling_group_id: "sgrp_summer_2", label: "Scaled", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "teams", [
		{ id: "team_summer_1", name: "Summer Showdown W1 Athletes", slug: "summer-showdown-w1-athletes", type: "competition_event", is_personal_team: 0, parent_organization_id: ORGANIZING_TEAM, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "team_summer_2", name: "Summer Showdown W2 Athletes", slug: "summer-showdown-w2-athletes", type: "competition_event", is_personal_team: 0, parent_organization_id: ORGANIZING_TEAM, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "competitions", [
		{
			id: "comp_summer_1",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_summer_1",
			group_id: "cgrp_seed_summer_showdown",
			slug: "summer-showdown-w1",
			name: "Summer Showdown Week 1",
			start_date: pastDate(7),
			end_date: pastDate(6),
			registration_opens_at: pastDate(21),
			registration_closes_at: pastDate(8),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_summer_1"}}',
			default_registration_fee_cents: 5000,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "comp_summer_2",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_summer_2",
			group_id: "cgrp_seed_summer_showdown",
			slug: "summer-showdown-w2",
			name: "Summer Showdown Week 2",
			start_date: pastDate(3),
			end_date: pastDate(2),
			registration_opens_at: pastDate(14),
			registration_closes_at: pastDate(4),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_summer_2"}}',
			default_registration_fee_cents: 5000,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Minimal registrations for Summer Showdown (just to have data)
	await batchInsert(client, "team_memberships", [
		{ id: "mbr_summer_admin_1", team_id: "team_summer_1", user_id: "usr_demo1admin", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "mbr_summer_derek_1", team_id: "team_summer_1", user_id: "usr_athlete_derek", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "mbr_summer_brandon_1", team_id: "team_summer_1", user_id: "usr_athlete_brandon", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "mbr_summer_admin_2", team_id: "team_summer_2", user_id: "usr_demo1admin", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "mbr_summer_nathan_2", team_id: "team_summer_2", user_id: "usr_athlete_nathan", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "mbr_summer_amanda_2", team_id: "team_summer_2", user_id: "usr_athlete_amanda", role_id: "member", is_system_role: 1, joined_at: ts, is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "competition_registrations", [
		{ id: "reg_summer_derek_1", event_id: "comp_summer_1", user_id: "usr_athlete_derek", team_member_id: "mbr_summer_derek_1", division_id: "slvl_summer_1_rx", registered_at: ts, status: "active", payment_status: "FREE", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "reg_summer_brandon_1", event_id: "comp_summer_1", user_id: "usr_athlete_brandon", team_member_id: "mbr_summer_brandon_1", division_id: "slvl_summer_1_sc", registered_at: ts, status: "active", payment_status: "FREE", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "reg_summer_nathan_2", event_id: "comp_summer_2", user_id: "usr_athlete_nathan", team_member_id: "mbr_summer_nathan_2", division_id: "slvl_summer_2_rx", registered_at: ts, status: "active", payment_status: "FREE", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "reg_summer_amanda_2", event_id: "comp_summer_2", user_id: "usr_athlete_amanda", team_member_id: "mbr_summer_amanda_2", division_id: "slvl_summer_2_sc", registered_at: ts, status: "active", payment_status: "FREE", created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
