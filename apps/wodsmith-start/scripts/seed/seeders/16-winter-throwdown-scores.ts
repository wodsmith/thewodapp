import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"
import {
	computeSortKey,
	sortKeyToString,
} from "../../../src/lib/scoring/sort/sort-key"
import { encodeRoundsRepsFromParts } from "../../../src/lib/scoring/encode/rounds-reps"
import { encodeLoadFromNumber } from "../../../src/lib/scoring/encode/load"

/**
 * Seeds competition scores for ALL events in the Winter Throwdown 2025.
 * RX division only (10 athletes). Creates a tight, dramatic leaderboard
 * where athletes swap positions across events — no single dominant athlete.
 *
 * Events:
 *   1. Fran (time, min)
 *   2. Grace (time, min)
 *   3. Cindy (rounds-reps, max)
 *   4. Linda (time, min)
 *   5a. 2K Row (time, min)           — sub-event of Rowing Triathlon
 *   5b. 500m Row Sprint (time, min)  — sub-event of Rowing Triathlon
 *   5c. Max Double Unders (reps, max) — sub-event of Rowing Triathlon
 *   6a. Snatch Ladder (time-with-cap, min, cap=360s) — sub-event of Snatch Ladder + Lifting
 *   6b. Three-Lift Total (load, sum, 3 rounds)       — sub-event of Snatch Ladder + Lifting
 *   7a. Sprint Couplet (time-with-cap, min, cap=480s) — sub-event of Sprint Series
 *   7b. Max Effort Deadlift (load, max)               — sub-event of Sprint Series
 */
export async function seed(client: Connection): Promise<void> {
	console.log("Seeding Winter Throwdown 2025 RX scores (tight leaderboard)...")

	const ts = now()
	const TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
	const DIV_RX = "slvl_winter_rx"

	// RX athletes
	const athletes = [
		{ name: "tyler", userId: "usr_athlete_tyler", regId: "creg_tyler_winter" },
		{ name: "nathan", userId: "usr_athlete_nathan", regId: "creg_nathan_winter" },
		{ name: "derek", userId: "usr_athlete_derek", regId: "creg_derek_winter" },
		{ name: "jordan", userId: "usr_athlete_jordan", regId: "creg_jordan_winter" },
		{ name: "mike", userId: "usr_athlete_mike", regId: "creg_mike_winter" },
		{ name: "ryan", userId: "usr_athlete_ryan", regId: "creg_ryan_winter" },
		{ name: "marcus", userId: "usr_athlete_marcus", regId: "creg_marcus_winter" },
		{ name: "alex", userId: "usr_athlete_alex", regId: "creg_alex_winter" },
		{ name: "brandon", userId: "usr_athlete_brandon", regId: "creg_brandon_winter" },
		{ name: "sarah", userId: "usr_athlete_sarah", regId: "creg_sarah_winter" },
	]

	// Sort key helper
	function sk(value: number, scheme: "time" | "time-with-cap" | "rounds-reps" | "reps" | "load", scoreType: "min" | "max" | "sum" = "min"): string {
		return sortKeyToString(
			computeSortKey({ value, status: "scored", scheme, scoreType }),
		)
	}

	// =========================================================================
	// Score data — designed so top 5 swap places constantly
	// =========================================================================

	// Event 1: Fran (time, seconds → ms) — Tyler dominates, Sarah close 2nd
	const franMs: Record<string, number> = {
		tyler: 185000,   // 3:05
		sarah: 192000,   // 3:12
		nathan: 198000,  // 3:18
		derek: 203000,   // 3:23
		jordan: 210000,  // 3:30
		mike: 215000,    // 3:35
		ryan: 222000,    // 3:42
		marcus: 228000,  // 3:48
		alex: 235000,    // 3:55
		brandon: 245000, // 4:05
	}

	// Event 2: Grace (time) — Nathan wins, Tyler drops to 5th
	const graceMs: Record<string, number> = {
		nathan: 142000,  // 2:22
		jordan: 148000,  // 2:28
		sarah: 155000,   // 2:35
		derek: 158000,   // 2:38
		tyler: 165000,   // 2:45
		marcus: 168000,  // 2:48
		alex: 172000,    // 2:52
		ryan: 178000,    // 2:58
		mike: 182000,    // 3:02
		brandon: 190000, // 3:10
	}

	// Event 3: Cindy (rounds-reps) — Mike surges to 1st, Sarah strong 2nd
	const cindyValues: Record<string, number> = {
		mike: encodeRoundsRepsFromParts(22, 5) ?? 2205,
		sarah: encodeRoundsRepsFromParts(21, 12) ?? 2112,
		derek: encodeRoundsRepsFromParts(21, 3) ?? 2103,
		ryan: encodeRoundsRepsFromParts(20, 15) ?? 2015,
		tyler: encodeRoundsRepsFromParts(20, 8) ?? 2008,
		jordan: encodeRoundsRepsFromParts(19, 18) ?? 1918,
		nathan: encodeRoundsRepsFromParts(19, 10) ?? 1910,
		alex: encodeRoundsRepsFromParts(19, 2) ?? 1902,
		marcus: encodeRoundsRepsFromParts(18, 14) ?? 1814,
		brandon: encodeRoundsRepsFromParts(18, 5) ?? 1805,
	}

	// Event 4: Linda (time) — Derek wins, top 6 within 30 seconds
	const lindaMs: Record<string, number> = {
		derek: 720000,   // 12:00
		marcus: 725000,  // 12:05
		tyler: 732000,   // 12:12
		nathan: 738000,  // 12:18
		sarah: 742000,   // 12:22
		jordan: 748000,  // 12:28
		alex: 760000,    // 12:40
		mike: 768000,    // 12:48
		brandon: 780000, // 13:00
		ryan: 792000,    // 13:12
	}

	// Event 5a: 2K Row (time) — Alex wins, big engine athletes shine
	const row2kMs: Record<string, number> = {
		alex: 418000,    // 6:58
		brandon: 422000, // 7:02
		jordan: 428000,  // 7:08
		ryan: 432000,    // 7:12
		tyler: 438000,   // 7:18
		derek: 442000,   // 7:22
		mike: 448000,    // 7:28
		nathan: 455000,  // 7:35
		marcus: 460000,  // 7:40
		sarah: 465000,   // 7:45
	}

	// Event 5b: 500m Row Sprint (time) — Brandon wins the sprint
	const row500Ms: Record<string, number> = {
		brandon: 88000,  // 1:28
		alex: 90000,     // 1:30
		tyler: 91000,    // 1:31
		jordan: 93000,   // 1:33
		nathan: 94000,   // 1:34
		derek: 95000,    // 1:35
		mike: 97000,     // 1:37
		ryan: 98000,     // 1:38
		marcus: 100000,  // 1:40
		sarah: 102000,   // 1:42
	}

	// Event 5c: Max Double Unders (reps) — Sarah dominates with gymnastic skill
	const maxDubs: Record<string, number> = {
		sarah: 152,
		ryan: 138,
		mike: 132,
		nathan: 125,
		marcus: 120,
		tyler: 115,
		derek: 108,
		jordan: 102,
		alex: 95,
		brandon: 88,
	}

	// Event 6a: Snatch Ladder (time-with-cap 360s) — Jordan fastest, Marcus caps out
	const snatchLadderMs: Record<string, number> = {
		jordan: 245000,  // 4:05
		tyler: 258000,   // 4:18
		derek: 268000,   // 4:28
		nathan: 275000,  // 4:35
		sarah: 285000,   // 4:45
		mike: 295000,    // 4:55
		alex: 310000,    // 5:10
		ryan: 325000,    // 5:25
		brandon: 340000, // 5:40
		marcus: 355000,  // 5:55 — just makes it
	}

	// Event 6b: Three-Lift Total (load, 3 rounds, sum) — Marcus is the strongest
	// Each round = one lift in lbs → encode as grams, store 3 separate round scores summed
	// Round 1: Snatch, Round 2: Clean & Jerk, Round 3: Back Squat
	const threeLiftLbs: Record<string, [number, number, number]> = {
		marcus: [205, 265, 365],   // total: 835
		derek: [195, 255, 350],    // total: 800
		jordan: [200, 250, 340],   // total: 790
		tyler: [190, 245, 345],    // total: 780
		mike: [185, 240, 335],     // total: 760
		nathan: [180, 235, 330],   // total: 745
		brandon: [175, 230, 325],  // total: 730
		alex: [170, 225, 320],     // total: 715
		ryan: [165, 220, 315],     // total: 700
		sarah: [125, 165, 255],    // total: 545
	}

	// Event 7a: Sprint Couplet (time-with-cap 480s) — Ryan fastest on gymnastics
	const sprintCoupletMs: Record<string, number> = {
		ryan: 312000,    // 5:12
		sarah: 318000,   // 5:18
		mike: 325000,    // 5:25
		tyler: 332000,   // 5:32
		nathan: 340000,  // 5:40
		derek: 348000,   // 5:48
		jordan: 355000,  // 5:55
		alex: 365000,    // 6:05
		marcus: 378000,  // 6:18
		brandon: 395000, // 6:35
	}

	// Event 7b: Max Effort Deadlift (load) — Marcus wins again, tight top 4
	const deadliftLbs: Record<string, number> = {
		marcus: 485,
		derek: 475,
		brandon: 465,
		jordan: 455,
		tyler: 450,
		mike: 440,
		nathan: 435,
		alex: 425,
		ryan: 415,
		sarah: 335,
	}

	// =========================================================================
	// Build score rows
	// =========================================================================
	const scores: Array<Record<string, unknown>> = []

	// Workout IDs (from track_workouts → workouts)
	const workoutIds: Record<string, string> = {
		fran: "wod_fran",
		grace: "wod_grace",
		cindy: "wod_cindy",
		linda: "wod_linda",
		row2k: "wod_winter_row_2k",
		row500: "wod_winter_row_500",
		maxDubs: "wod_winter_max_dubs",
		snatchLadder: "wod_winter_snatch_ladder",
		threeLift: "wod_winter_three_lift_total",
		sprintCouplet: "wod_winter_sprint_couplet",
		deadlift: "wod_winter_max_deadlift",
	}

	// Track workout IDs (competition_event_id)
	const twIds: Record<string, string> = {
		fran: "tw_winter_event1_fran",
		grace: "tw_winter_event2_grace",
		cindy: "tw_winter_event3_cindy",
		linda: "tw_winter_event4_linda",
		row2k: "tw_winter_row_2k",
		row500: "tw_winter_row_500",
		maxDubs: "tw_winter_max_dubs",
		snatchLadder: "tw_winter_snatch_ladder",
		threeLift: "tw_winter_three_lift_total",
		sprintCouplet: "tw_winter_sprint_couplet",
		deadlift: "tw_winter_max_deadlift",
	}

	function addTimeScore(eventKey: string, data: Record<string, number>, scheme: "time" | "time-with-cap" = "time") {
		for (const a of athletes) {
			const ms = data[a.name]
			if (ms === undefined) continue
			scores.push({
				id: `scr_wt_${a.name}_${eventKey}`,
				user_id: a.userId,
				team_id: TEAM_ID,
				workout_id: workoutIds[eventKey],
				competition_event_id: twIds[eventKey],
				scheme,
				score_type: "min",
				score_value: ms,
				status: "scored",
				status_order: 0,
				sort_key: sk(ms, scheme, "min"),
				as_rx: 1,
				scaling_level_id: DIV_RX,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}

	function addRepsScore(eventKey: string, data: Record<string, number>) {
		for (const a of athletes) {
			const val = data[a.name]
			if (val === undefined) continue
			scores.push({
				id: `scr_wt_${a.name}_${eventKey}`,
				user_id: a.userId,
				team_id: TEAM_ID,
				workout_id: workoutIds[eventKey],
				competition_event_id: twIds[eventKey],
				scheme: "reps",
				score_type: "max",
				score_value: val,
				status: "scored",
				status_order: 0,
				sort_key: sk(val, "reps", "max"),
				as_rx: 1,
				scaling_level_id: DIV_RX,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}

	function addRoundsRepsScore(eventKey: string, data: Record<string, number>) {
		for (const a of athletes) {
			const val = data[a.name]
			if (val === undefined) continue
			scores.push({
				id: `scr_wt_${a.name}_${eventKey}`,
				user_id: a.userId,
				team_id: TEAM_ID,
				workout_id: workoutIds[eventKey],
				competition_event_id: twIds[eventKey],
				scheme: "rounds-reps",
				score_type: "max",
				score_value: val,
				status: "scored",
				status_order: 0,
				sort_key: sk(val, "rounds-reps", "max"),
				as_rx: 1,
				scaling_level_id: DIV_RX,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}

	function addLoadScore(eventKey: string, data: Record<string, number>, scoreType: "max" | "sum" = "max") {
		for (const a of athletes) {
			const lbs = data[a.name]
			if (lbs === undefined) continue
			const grams = encodeLoadFromNumber(lbs, "lbs") ?? Math.round(lbs * 453.592)
			scores.push({
				id: `scr_wt_${a.name}_${eventKey}`,
				user_id: a.userId,
				team_id: TEAM_ID,
				workout_id: workoutIds[eventKey],
				competition_event_id: twIds[eventKey],
				scheme: "load",
				score_type: scoreType,
				score_value: grams,
				status: "scored",
				status_order: 0,
				sort_key: sk(grams, "load", scoreType),
				as_rx: 1,
				scaling_level_id: DIV_RX,
				recorded_at: ts,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
	}

	// Standalone events
	addTimeScore("fran", franMs)
	addTimeScore("grace", graceMs)
	addRoundsRepsScore("cindy", cindyValues)
	addTimeScore("linda", lindaMs)

	// Rowing Triathlon sub-events
	addTimeScore("row2k", row2kMs)
	addTimeScore("row500", row500Ms)
	addRepsScore("maxDubs", maxDubs)

	// Snatch Ladder + Lifting sub-events
	addTimeScore("snatchLadder", snatchLadderMs, "time-with-cap")

	// Three-Lift Total: sum of 3 lifts (encode total lbs as grams)
	const threeLiftTotals: Record<string, number> = {}
	for (const [name, [s, cj, bs]] of Object.entries(threeLiftLbs)) {
		threeLiftTotals[name] = s + cj + bs
	}
	addLoadScore("threeLift", threeLiftTotals, "sum")

	// Sprint Series sub-events
	addTimeScore("sprintCouplet", sprintCoupletMs, "time-with-cap")
	addLoadScore("deadlift", deadliftLbs, "max")

	await batchInsert(client, "scores", scores)

	console.log(`  Inserted ${scores.length} scores for ${athletes.length} RX athletes across 11 events`)
	console.log("")
	console.log("Leaderboard should be a tight race:")
	console.log("  Tyler — fast on Fran/Linda, consistent everywhere")
	console.log("  Nathan — Grace winner, solid all-around")
	console.log("  Derek — Linda winner, strong lifts")
	console.log("  Jordan — Snatch Ladder winner, good engine")
	console.log("  Mike — Cindy winner, drops on rowing")
	console.log("  Marcus — Strongest lifter, slower on cardio")
	console.log("  Sarah — Gymnastic specialist, Double Unders queen")
	console.log("  Ryan — Sprint Couplet winner, weaker on strength")
	console.log("  Alex — Rowing specialist, 2K Row winner")
	console.log("  Brandon — Row Sprint winner, inconsistent elsewhere")
}
