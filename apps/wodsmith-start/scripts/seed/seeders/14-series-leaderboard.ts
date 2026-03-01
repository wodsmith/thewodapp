import type { Connection } from "mysql2/promise"
import { batchInsert, now, pastDate } from "../helpers"
import {
	computeSortKey,
	sortKeyToString,
} from "../../../src/lib/scoring/sort/sort-key"
import { encodeRoundsRepsFromParts } from "../../../src/lib/scoring/encode/rounds-reps"
import { encodeLoadFromNumber } from "../../../src/lib/scoring/encode/load"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding series leaderboard data...")

	const ts = now()
	const ORGANIZING_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"

	// ─────────────────────────────────────────────
	// Competition group (series)
	// ─────────────────────────────────────────────
	await batchInsert(client, "competition_groups", [
		{
			id: "cgrp_seed_throwdown_series",
			organizing_team_id: ORGANIZING_TEAM,
			slug: "2026-series-leaderboard-demo",
			name: "2026 Series Leaderboard Demo",
			description: "Seed data for the series global leaderboard feature.",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Scaling groups
	// ─────────────────────────────────────────────
	await batchInsert(client, "scaling_groups", [
		{
			id: "sgrp_seed_series",
			title: "2026 Series Demo Divisions",
			description: "Divisions for 2026 Series Demo",
			team_id: ORGANIZING_TEAM,
			is_default: 0,
			is_system: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "sgrp_seed_bad",
			title: "Wrong Series Divisions",
			description: "Mismatched divisions for series leaderboard test",
			team_id: ORGANIZING_TEAM,
			is_default: 0,
			is_system: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Scaling levels
	// ─────────────────────────────────────────────
	await batchInsert(client, "scaling_levels", [
		// sgrp_seed_series
		{
			id: "slvl_seed_rx",
			scaling_group_id: "sgrp_seed_series",
			label: "RX",
			position: 0,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "slvl_seed_scaled",
			scaling_group_id: "sgrp_seed_series",
			label: "Scaled",
			position: 1,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// sgrp_seed_bad
		{
			id: "slvl_seed_bad_rx",
			scaling_group_id: "sgrp_seed_bad",
			label: "RX",
			position: 0,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Shared workouts (same workout referenced by all 3 main comps)
	// ─────────────────────────────────────────────
	await batchInsert(client, "workouts", [
		{
			id: "wod_seed_s1",
			name: "Series Event 1: Fran",
			description: "21-15-9 Thrusters (95/65) and Pull-ups. Classic benchmark for time.",
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
			id: "wod_seed_s2",
			name: "Series Event 2: Cindy",
			description: "As many rounds as possible in 20 minutes of: 5 Pull-ups, 10 Push-ups, 15 Air Squats.",
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
			id: "wod_seed_s3",
			name: "Series Event 3: Grace",
			description: "30 Clean & Jerks for load. Find your heaviest single.",
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

	// ─────────────────────────────────────────────
	// Competition-event teams (one per competition)
	// ─────────────────────────────────────────────
	await batchInsert(client, "teams", [
		{
			id: "team_seed_throwdown_a",
			name: "2026 Series Demo - Throwdown A Athletes",
			slug: "2026-series-demo-throwdown-a-athletes",
			description: "Athlete team for 2026 Series Demo Throwdown A",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "team_seed_throwdown_b",
			name: "2026 Series Demo - Throwdown B Athletes",
			slug: "2026-series-demo-throwdown-b-athletes",
			description: "Athlete team for 2026 Series Demo Throwdown B",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "team_seed_throwdown_c",
			name: "2026 Series Demo - Throwdown C Athletes",
			slug: "2026-series-demo-throwdown-c-athletes",
			description: "Athlete team for 2026 Series Demo Throwdown C",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "team_seed_throwdown_bad",
			name: "2026 Series Demo - Mismatched Comp Athletes",
			slug: "2026-series-demo-throwdown-bad-athletes",
			description: "Athlete team for 2026 Series Demo Mismatched Comp (mismatch test)",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Competitions
	// ─────────────────────────────────────────────
	await batchInsert(client, "competitions", [
		{
			id: "comp_seed_throwdown_a",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_seed_throwdown_a",
			group_id: "cgrp_seed_throwdown_series",
			slug: "2026-series-demo-throwdown-a",
			name: "2026 Series Demo - Throwdown A",
			description: "First event in the 2026 Series Leaderboard Demo.",
			start_date: pastDate(21),
			end_date: pastDate(20),
			registration_opens_at: pastDate(35),
			registration_closes_at: pastDate(22),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_seed_series"}}',
			default_registration_fee_cents: 0,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "comp_seed_throwdown_b",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_seed_throwdown_b",
			group_id: "cgrp_seed_throwdown_series",
			slug: "2026-series-demo-throwdown-b",
			name: "2026 Series Demo - Throwdown B",
			description: "Second event in the 2026 Series Leaderboard Demo.",
			start_date: pastDate(14),
			end_date: pastDate(13),
			registration_opens_at: pastDate(28),
			registration_closes_at: pastDate(15),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_seed_series"}}',
			default_registration_fee_cents: 0,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "comp_seed_throwdown_c",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_seed_throwdown_c",
			group_id: "cgrp_seed_throwdown_series",
			slug: "2026-series-demo-throwdown-c",
			name: "2026 Series Demo - Throwdown C",
			description: "Third event in the 2026 Series Leaderboard Demo.",
			start_date: pastDate(7),
			end_date: pastDate(6),
			registration_opens_at: pastDate(21),
			registration_closes_at: pastDate(8),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_seed_series"}}',
			default_registration_fee_cents: 0,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "comp_seed_throwdown_bad",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_seed_throwdown_bad",
			group_id: "cgrp_seed_throwdown_series",
			slug: "2026-series-demo-throwdown-bad",
			name: "2026 Series Demo - Mismatched Comp",
			description: "Competition with a mismatched scaling group — for series leaderboard mismatch testing.",
			start_date: pastDate(5),
			end_date: pastDate(4),
			registration_opens_at: pastDate(19),
			registration_closes_at: pastDate(6),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_seed_bad"}}',
			default_registration_fee_cents: 0,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Programming tracks (one per competition)
	// ─────────────────────────────────────────────
	await batchInsert(client, "programming_tracks", [
		{
			id: "track_seed_a",
			name: "2026 Series Demo - Throwdown A Events",
			description: "Competition events for Throwdown A",
			type: "team_owned",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: "sgrp_seed_series",
			is_public: 0,
			competition_id: "comp_seed_throwdown_a",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "track_seed_b",
			name: "2026 Series Demo - Throwdown B Events",
			description: "Competition events for Throwdown B",
			type: "team_owned",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: "sgrp_seed_series",
			is_public: 0,
			competition_id: "comp_seed_throwdown_b",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "track_seed_c",
			name: "2026 Series Demo - Throwdown C Events",
			description: "Competition events for Throwdown C",
			type: "team_owned",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: "sgrp_seed_series",
			is_public: 0,
			competition_id: "comp_seed_throwdown_c",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "track_seed_bad",
			name: "2026 Series Demo - Mismatched Comp Events",
			description: "Competition events for Mismatched Comp (mismatch test)",
			type: "team_owned",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: "sgrp_seed_bad",
			is_public: 0,
			competition_id: "comp_seed_throwdown_bad",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Track workouts (3 events per comp, all referencing same workout IDs)
	// ─────────────────────────────────────────────
	await batchInsert(client, "track_workouts", [
		// Comp A
		{ id: "tw_seed_a_e1", track_id: "track_seed_a", workout_id: "wod_seed_s1", track_order: 0, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_a_e2", track_id: "track_seed_a", workout_id: "wod_seed_s2", track_order: 1, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_a_e3", track_id: "track_seed_a", workout_id: "wod_seed_s3", track_order: 2, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		// Comp B
		{ id: "tw_seed_b_e1", track_id: "track_seed_b", workout_id: "wod_seed_s1", track_order: 0, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_b_e2", track_id: "track_seed_b", workout_id: "wod_seed_s2", track_order: 1, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_b_e3", track_id: "track_seed_b", workout_id: "wod_seed_s3", track_order: 2, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		// Comp C
		{ id: "tw_seed_c_e1", track_id: "track_seed_c", workout_id: "wod_seed_s1", track_order: 0, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_c_e2", track_id: "track_seed_c", workout_id: "wod_seed_s2", track_order: 1, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_seed_c_e3", track_id: "track_seed_c", workout_id: "wod_seed_s3", track_order: 2, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
		// Comp Bad (no scores seeded for this one — it's for the mismatch test)
		{ id: "tw_seed_bad_e1", track_id: "track_seed_bad", workout_id: "wod_seed_s1", track_order: 0, event_status: "published", heat_status: "published", points_multiplier: 100, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// ─────────────────────────────────────────────
	// Team memberships for each athlete in each comp's competition team
	//
	// Comp A: mike, sarah, alex
	// Comp B: ryan, marcus, tyler
	// Comp C: jordan, nathan, derek
	// ─────────────────────────────────────────────
	function mem(
		id: string,
		teamId: string,
		userId: string,
	) {
		return {
			id,
			team_id: teamId,
			user_id: userId,
			role_id: "member",
			is_system_role: 1,
			joined_at: ts,
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	await batchInsert(client, "team_memberships", [
		// Comp A
		mem("mbr_seed_admin_compa", "team_seed_throwdown_a", "usr_demo1admin"),
		mem("mbr_seed_mike_compa", "team_seed_throwdown_a", "usr_athlete_mike"),
		mem("mbr_seed_sarah_compa", "team_seed_throwdown_a", "usr_athlete_sarah"),
		mem("mbr_seed_alex_compa", "team_seed_throwdown_a", "usr_athlete_alex"),
		// Comp B
		mem("mbr_seed_admin_compb", "team_seed_throwdown_b", "usr_demo1admin"),
		mem("mbr_seed_ryan_compb", "team_seed_throwdown_b", "usr_athlete_ryan"),
		mem("mbr_seed_marcus_compb", "team_seed_throwdown_b", "usr_athlete_marcus"),
		mem("mbr_seed_tyler_compb", "team_seed_throwdown_b", "usr_athlete_tyler"),
		// Comp C
		mem("mbr_seed_admin_compc", "team_seed_throwdown_c", "usr_demo1admin"),
		mem("mbr_seed_jordan_compc", "team_seed_throwdown_c", "usr_athlete_jordan"),
		mem("mbr_seed_nathan_compc", "team_seed_throwdown_c", "usr_athlete_nathan"),
		mem("mbr_seed_derek_compc", "team_seed_throwdown_c", "usr_athlete_derek"),
		// Comp Bad — 2 athletes registered under the wrong division (slvl_seed_bad_rx)
		// These will exercise the migration path in switchCompetitionScalingGroupFn
		mem("mbr_seed_admin_compbad", "team_seed_throwdown_bad", "usr_demo1admin"),
		mem("mbr_seed_brandon_compbad", "team_seed_throwdown_bad", "usr_athlete_brandon"),
		mem("mbr_seed_megan_compbad", "team_seed_throwdown_bad", "usr_athlete_megan"),
	])

	// ─────────────────────────────────────────────
	// Competition registrations (one per athlete per comp)
	// ─────────────────────────────────────────────
	function reg(
		id: string,
		eventId: string,
		userId: string,
		teamMemberId: string,
	) {
		return {
			id,
			event_id: eventId,
			user_id: userId,
			team_member_id: teamMemberId,
			division_id: "slvl_seed_rx",
			registered_at: ts,
			status: "active",
			payment_status: "FREE",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	await batchInsert(client, "competition_registrations", [
		// Comp A
		reg("reg_seed_mike_compa", "comp_seed_throwdown_a", "usr_athlete_mike", "mbr_seed_mike_compa"),
		reg("reg_seed_sarah_compa", "comp_seed_throwdown_a", "usr_athlete_sarah", "mbr_seed_sarah_compa"),
		reg("reg_seed_alex_compa", "comp_seed_throwdown_a", "usr_athlete_alex", "mbr_seed_alex_compa"),
		// Comp B
		reg("reg_seed_ryan_compb", "comp_seed_throwdown_b", "usr_athlete_ryan", "mbr_seed_ryan_compb"),
		reg("reg_seed_marcus_compb", "comp_seed_throwdown_b", "usr_athlete_marcus", "mbr_seed_marcus_compb"),
		reg("reg_seed_tyler_compb", "comp_seed_throwdown_b", "usr_athlete_tyler", "mbr_seed_tyler_compb"),
		// Comp C
		reg("reg_seed_jordan_compc", "comp_seed_throwdown_c", "usr_athlete_jordan", "mbr_seed_jordan_compc"),
		reg("reg_seed_nathan_compc", "comp_seed_throwdown_c", "usr_athlete_nathan", "mbr_seed_nathan_compc"),
		reg("reg_seed_derek_compc", "comp_seed_throwdown_c", "usr_athlete_derek", "mbr_seed_derek_compc"),
		// Comp Bad — registered under slvl_seed_bad_rx (the wrong group)
		// switchCompetitionScalingGroupFn should migrate these to slvl_seed_rx
		{
			...reg("reg_seed_brandon_compbad", "comp_seed_throwdown_bad", "usr_athlete_brandon", "mbr_seed_brandon_compbad"),
			division_id: "slvl_seed_bad_rx",
		},
		{
			...reg("reg_seed_megan_compbad", "comp_seed_throwdown_bad", "usr_athlete_megan", "mbr_seed_megan_compbad"),
			division_id: "slvl_seed_bad_rx",
		},
	])

	// ─────────────────────────────────────────────
	// competition_divisions config for slvl_seed_bad_rx in comp_seed_throwdown_bad
	// Verifies that description + fee migrate to the new division after the switch
	// ─────────────────────────────────────────────
	await batchInsert(client, "competition_divisions", [
		{
			id: "cdfee_seed_bad_rx",
			competition_id: "comp_seed_throwdown_bad",
			division_id: "slvl_seed_bad_rx",
			fee_cents: 5000, // $50
			description: "RX division for mismatched comp — migration test",
			max_spots: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─────────────────────────────────────────────
	// Scores
	//
	// Event 1 — "time" (ms, lower is better, scoreType "min")
	// Event 2 — "rounds-reps" (encoded: rounds * 100_000 + reps, higher is better)
	// Event 3 — "load" (grams = lbs * 453.592, higher is better)
	//
	// Score sort keys encode: status=scored(0) + normalised value.
	//
	// Athlete→comp mapping:
	//   Comp A: mike, sarah, alex
	//   Comp B: ryan, marcus, tyler
	//   Comp C: jordan, nathan, derek
	// ─────────────────────────────────────────────

	// Helper: compute sort key string for a scored result
	function sk(value: number, scheme: "time" | "rounds-reps" | "load"): string {
		const scoreType = scheme === "time" ? "min" : "max"
		return sortKeyToString(
			computeSortKey({ value, status: "scored", scheme, scoreType }),
		)
	}

	// Event 1 — time in milliseconds
	const e1Times: Record<string, number> = {
		ryan: 210000,   // 3:30
		mike: 225000,   // 3:45
		jordan: 235000, // 3:55
		sarah: 252000,  // 4:12
		nathan: 270000, // 4:30
		marcus: 285000, // 4:45
		alex: 303000,   // 5:03
		derek: 330000,  // 5:30
		tyler: 375000,  // 6:15
	}

	// Event 2 — rounds-reps (rounds * 100_000 + reps)
	const e2Values: Record<string, number> = {
		ryan: encodeRoundsRepsFromParts(7, 15) ?? 715,
		mike: encodeRoundsRepsFromParts(7, 5) ?? 705,
		jordan: encodeRoundsRepsFromParts(6, 18) ?? 618,
		sarah: encodeRoundsRepsFromParts(6, 8) ?? 608,
		nathan: encodeRoundsRepsFromParts(6, 0) ?? 600,
		marcus: encodeRoundsRepsFromParts(5, 20) ?? 520,
		alex: encodeRoundsRepsFromParts(5, 10) ?? 510,
		derek: encodeRoundsRepsFromParts(5, 0) ?? 500,
		tyler: encodeRoundsRepsFromParts(4, 15) ?? 415,
	}

	// Event 3 — load in grams (lbs * 453.592, rounded)
	const e3Lbs: Record<string, number> = {
		ryan: 275,
		mike: 265,
		jordan: 270,
		sarah: 245,
		nathan: 255,
		marcus: 240,
		alex: 230,
		derek: 235,
		tyler: 225,
	}
	const e3Grams: Record<string, number> = Object.fromEntries(
		Object.entries(e3Lbs).map(([name, lbs]) => [
			name,
			encodeLoadFromNumber(lbs, "lbs") ?? Math.round(lbs * 453.592),
		]),
	)

	// scoreRow builds a full row for the scores table.
	// competition_event_id is the track_workout ID.
	function scoreRow(
		id: string,
		userId: string,
		competitionEventId: string,
		workoutId: string,
		scheme: "time" | "rounds-reps" | "load",
		scoreValue: number,
	) {
		const scoreType = scheme === "time" ? "min" : "max"
		const statusOrder = 0 // scored
		return {
			id,
			user_id: userId,
			team_id: ORGANIZING_TEAM,
			workout_id: workoutId,
			competition_event_id: competitionEventId,
			scheme,
			score_type: scoreType,
			score_value: scoreValue,
			status: "scored",
			status_order: statusOrder,
			sort_key: sk(scoreValue, scheme),
			as_rx: 1,
			scaling_level_id: "slvl_seed_rx",
			recorded_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	// Build all 27 score rows (9 athletes × 3 events)
	// Comp A athletes: mike, sarah, alex
	// Comp B athletes: ryan, marcus, tyler
	// Comp C athletes: jordan, nathan, derek

	const compAAthletes = [
		{ name: "mike", userId: "usr_athlete_mike" },
		{ name: "sarah", userId: "usr_athlete_sarah" },
		{ name: "alex", userId: "usr_athlete_alex" },
	]
	const compBAthletes = [
		{ name: "ryan", userId: "usr_athlete_ryan" },
		{ name: "marcus", userId: "usr_athlete_marcus" },
		{ name: "tyler", userId: "usr_athlete_tyler" },
	]
	const compCAthletes = [
		{ name: "jordan", userId: "usr_athlete_jordan" },
		{ name: "nathan", userId: "usr_athlete_nathan" },
		{ name: "derek", userId: "usr_athlete_derek" },
	]

	const scores = [
		// ─── Comp A ───
		...compAAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e1`,
				userId,
				"tw_seed_a_e1",
				"wod_seed_s1",
				"time",
				e1Times[name],
			),
		),
		...compAAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e2`,
				userId,
				"tw_seed_a_e2",
				"wod_seed_s2",
				"rounds-reps",
				e2Values[name],
			),
		),
		...compAAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e3`,
				userId,
				"tw_seed_a_e3",
				"wod_seed_s3",
				"load",
				e3Grams[name],
			),
		),
		// ─── Comp B ───
		...compBAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e1`,
				userId,
				"tw_seed_b_e1",
				"wod_seed_s1",
				"time",
				e1Times[name],
			),
		),
		...compBAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e2`,
				userId,
				"tw_seed_b_e2",
				"wod_seed_s2",
				"rounds-reps",
				e2Values[name],
			),
		),
		...compBAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e3`,
				userId,
				"tw_seed_b_e3",
				"wod_seed_s3",
				"load",
				e3Grams[name],
			),
		),
		// ─── Comp C ───
		...compCAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e1`,
				userId,
				"tw_seed_c_e1",
				"wod_seed_s1",
				"time",
				e1Times[name],
			),
		),
		...compCAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e2`,
				userId,
				"tw_seed_c_e2",
				"wod_seed_s2",
				"rounds-reps",
				e2Values[name],
			),
		),
		...compCAthletes.map(({ name, userId }) =>
			scoreRow(
				`scr_seed_${name}_e3`,
				userId,
				"tw_seed_c_e3",
				"wod_seed_s3",
				"load",
				e3Grams[name],
			),
		),
	]

	await batchInsert(client, "scores", scores)
}
