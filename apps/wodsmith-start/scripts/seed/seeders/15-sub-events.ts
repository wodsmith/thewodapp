import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

const BOX1_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"

/**
 * Seeds sub-event test data for the Winter Throwdown 2025 competition.
 *
 * Creates the following test scenarios:
 *
 * 1. PARENT WITH 3 SUB-EVENTS (Event 5: "Rowing Triathlon")
 *    - 2K Row (time), 500m Row (time), Max Cal Row (reps)
 *    - Tests: basic parent-child rendering, mixed schemes, leaderboard aggregation
 *
 * 2. PARENT WITH 2 SUB-EVENTS, MIXED SCHEMES + MULTI-ROUND (Event 6: "Snatch Ladder + Lifting")
 *    - Snatch Ladder (time-with-cap, 6 min)
 *    - Three-Lift Total (load, rounds_to_score=3, score_type=sum)
 *    - Tests: timed sub-event + multi-round lifting sub-event with sum aggregation
 *
 * 3. PARENT WITH 2 SUB-EVENTS, DIFFERENT MULTIPLIERS (Event 7: "Sprint Series")
 *    - Sprint Couplet (time, 1x points), Max Effort Deadlift (load, 2x points)
 *    - Tests: unequal point weighting across sub-events
 *
 * Existing standalone events (Events 1-4) are untouched to verify
 * that standalone behavior is unaffected.
 */
export async function seed(client: Connection): Promise<void> {
	console.log("Seeding sub-event test data...")

	const ts = now()

	// =========================================================================
	// Workouts for sub-events
	// =========================================================================
	await batchInsert(client, "workouts", [
		// Rowing Triathlon sub-workouts
		{
			id: "wod_winter_row_2k",
			name: "2K Row",
			description:
				"For time:\n\n• 2,000 meter row\n\nAll-out effort. Damper setting is athlete's choice.",
			scheme: "time",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: "min",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_winter_row_500",
			name: "500m Row Sprint",
			description:
				"For time:\n\n• 500 meter row\n\nMaximum intensity sprint. Recovery time between sub-events.",
			scheme: "time",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: "min",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_winter_max_dubs",
			name: "Max Double Unders",
			description:
				"2 minutes:\n\n• Max unbroken double unders\n\nScore is highest unbroken set. Singles do not count. One attempt.",
			scheme: "reps",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: 120,
			score_type: "max",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Snatch Ladder sub-workout (timed)
		{
			id: "wod_winter_snatch_ladder",
			name: "Snatch Ladder",
			description:
				"For time:\n\n• 3 Snatches @ 135/95\n• 3 Snatches @ 155/105\n• 3 Snatches @ 175/115\n• 2 Snatches @ 195/130\n• 1 Snatch @ 215/145\n\nTime cap: 6 minutes. Must complete each set before moving to next weight.",
			scheme: "time-with-cap",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: 360,
			score_type: "min",
			tiebreak_scheme: "reps",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Three-Lift Total sub-workout (3 rounds, sum of lifts)
		{
			id: "wod_winter_three_lift_total",
			name: "Three-Lift Total",
			description:
				"For max total load:\n\nRound 1: 1RM Snatch\nRound 2: 1RM Clean & Jerk\nRound 3: 1RM Back Squat\n\n3 attempts per lift, 60 seconds between attempts.\nScore is the sum of all three lifts.",
			scheme: "load",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 3,
			time_cap: null,
			score_type: "sum",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Sprint Series sub-workouts (different multipliers)
		{
			id: "wod_winter_sprint_couplet",
			name: "Sprint Couplet",
			description:
				"For time:\n\n3 rounds:\n• 10 Burpee Box Jump Overs (24/20)\n• 15 Chest-to-Bar Pull-ups\n\nTime cap: 8 minutes",
			scheme: "time-with-cap",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: 480,
			score_type: "min",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_winter_max_deadlift",
			name: "Max Effort Deadlift",
			description:
				"For max load:\n\n• 1 Rep Max Deadlift\n• 3 attempts, 60 seconds between attempts\n\nScore is heaviest successful lift.",
			scheme: "load",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: "max",
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Parent event "workouts" (containers — no real workout content)
		{
			id: "wod_winter_rowing_triathlon",
			name: "Rowing Triathlon",
			description:
				"Three challenges testing different energy systems. Athletes row a 2K, sprint a 500m, then test their double under skill. Points from all three sub-events are combined.",
			scheme: "time",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: null,
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_winter_snatch_complex",
			name: "Snatch Ladder + Lifting",
			description: "Two-part barbell test: race through a timed snatch ladder, then hit your best lifts across three movements. Total lifting score is the sum of all three 1RMs.",
			scheme: "load",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: null,
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "wod_winter_sprint_series",
			name: "Sprint Series",
			description:
				"A two-part test combining a fast couplet with a max effort deadlift. The deadlift is worth double points!",
			scheme: "time",
			scope: "private",
			team_id: BOX1_TEAM,
			rounds_to_score: 1,
			time_cap: null,
			score_type: null,
			source_workout_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// =========================================================================
	// Parent track workouts (events 5, 6, 7)
	// =========================================================================
	await batchInsert(client, "track_workouts", [
		// Event 5: Rowing Triathlon (parent, 3 children)
		{
			id: "tw_winter_event5_rowing",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_rowing_triathlon",
			track_order: 5.0,
			parent_event_id: null,
			notes: "Event 5: Rowing Triathlon — three sub-events combining different rowing distances and strategies.",
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Event 6: Snatch Ladder + Lifting (parent, 2 children — timed + multi-round lifts)
		{
			id: "tw_winter_event6_snatch",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_snatch_complex",
			track_order: 6.0,
			parent_event_id: null,
			notes: "Event 6: Snatch Ladder + Lifting — timed ladder + 3-lift total (sum of rounds).",
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Event 7: Sprint Series (parent, 2 children with different multipliers)
		{
			id: "tw_winter_event7_sprints",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_sprint_series",
			track_order: 7.0,
			parent_event_id: null,
			notes: "Event 7: Sprint Series — two sub-events with different point multipliers.",
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// =========================================================================
	// Sub-event track workouts (children)
	// =========================================================================
	await batchInsert(client, "track_workouts", [
		// Rowing Triathlon children (3 sub-events, mixed schemes)
		{
			id: "tw_winter_row_2k",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_row_2k",
			track_order: 5.01,
			parent_event_id: "tw_winter_event5_rowing",
			notes: null,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_winter_row_500",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_row_500",
			track_order: 5.02,
			parent_event_id: "tw_winter_event5_rowing",
			notes: null,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_winter_max_dubs",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_max_dubs",
			track_order: 5.03,
			parent_event_id: "tw_winter_event5_rowing",
			notes: null,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Snatch Ladder + Lifting children (timed ladder + multi-round lifts)
		{
			id: "tw_winter_snatch_ladder",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_snatch_ladder",
			track_order: 6.01,
			parent_event_id: "tw_winter_event6_snatch",
			notes: null,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_winter_three_lift_total",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_three_lift_total",
			track_order: 6.02,
			parent_event_id: "tw_winter_event6_snatch",
			notes: null,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Sprint Series children (different multipliers)
		{
			id: "tw_winter_sprint_couplet",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_sprint_couplet",
			track_order: 7.01,
			parent_event_id: "tw_winter_event7_sprints",
			notes: null,
			points_multiplier: 100, // 1x points
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tw_winter_max_deadlift",
			track_id: "track_winter_throwdown_2025",
			workout_id: "wod_winter_max_deadlift",
			track_order: 7.02,
			parent_event_id: "tw_winter_event7_sprints",
			notes: null,
			points_multiplier: 200, // 2x points — heavier weight on max effort
			heat_status: "draft",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// =========================================================================
	// Division-specific scaling descriptions for sub-events
	// =========================================================================
	await batchInsert(client, "workout_scaling_descriptions", [
		// 2K Row — RX vs Scaled
		{ id: "wsd_row2k_rx", workout_id: "wod_winter_row_2k", scaling_level_id: "slvl_winter_rx", description: "2,000m row. Damper setting 6-8 recommended.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_row2k_scaled", workout_id: "wod_winter_row_2k", scaling_level_id: "slvl_winter_scaled", description: "1,500m row. Damper setting 4-6 recommended.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_row2k_masters", workout_id: "wod_winter_row_2k", scaling_level_id: "slvl_winter_masters_40", description: "1,750m row. Damper setting 5-7 recommended.", created_at: ts, updated_at: ts, update_counter: 0 },
		// Max Double Unders — scaled to single unders
		{ id: "wsd_dubs_rx", workout_id: "wod_winter_max_dubs", scaling_level_id: "slvl_winter_rx", description: "2 minutes max unbroken double unders. One attempt.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_dubs_scaled", workout_id: "wod_winter_max_dubs", scaling_level_id: "slvl_winter_scaled", description: "2 minutes max unbroken single unders. One attempt.", created_at: ts, updated_at: ts, update_counter: 0 },
		// Snatch Ladder (timed) — different starting weights
		{ id: "wsd_snatch_rx", workout_id: "wod_winter_snatch_ladder", scaling_level_id: "slvl_winter_rx", description: "As written: 135/95 → 215/145. Time cap 6 min.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_snatch_scaled", workout_id: "wod_winter_snatch_ladder", scaling_level_id: "slvl_winter_scaled", description: "75/55 → 155/105. Power snatch allowed. Time cap 6 min.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_snatch_masters", workout_id: "wod_winter_snatch_ladder", scaling_level_id: "slvl_winter_masters_40", description: "95/65 → 185/125. Time cap 6 min.", created_at: ts, updated_at: ts, update_counter: 0 },
		// Three-Lift Total — 3 rounds (Snatch, C&J, Back Squat), score_type=sum
		{ id: "wsd_3lift_rx", workout_id: "wod_winter_three_lift_total", scaling_level_id: "slvl_winter_rx", description: "1RM Snatch + 1RM Clean & Jerk + 1RM Back Squat. 3 attempts per lift.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_3lift_scaled", workout_id: "wod_winter_three_lift_total", scaling_level_id: "slvl_winter_scaled", description: "1RM Power Snatch + 1RM Power Clean + 1RM Front Squat. 3 attempts per lift.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_3lift_masters", workout_id: "wod_winter_three_lift_total", scaling_level_id: "slvl_winter_masters_40", description: "1RM Snatch + 1RM Clean & Jerk + 1RM Back Squat. 3 attempts per lift.", created_at: ts, updated_at: ts, update_counter: 0 },
		// Sprint Couplet — scaled modifications
		{ id: "wsd_sprint_rx", workout_id: "wod_winter_sprint_couplet", scaling_level_id: "slvl_winter_rx", description: "As written: Burpee Box Jump Overs (24/20\") + Chest-to-Bar Pull-ups", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_sprint_scaled", workout_id: "wod_winter_sprint_couplet", scaling_level_id: "slvl_winter_scaled", description: "Burpee Box Step Overs (20\") + Chin-Over-Bar Pull-ups (banded allowed)", created_at: ts, updated_at: ts, update_counter: 0 },
		// Max Deadlift — same across divisions (bodyweight-relative)
		{ id: "wsd_dl_rx", workout_id: "wod_winter_max_deadlift", scaling_level_id: "slvl_winter_rx", description: "Conventional or sumo deadlift. No straps, belt allowed.", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wsd_dl_scaled", workout_id: "wod_winter_max_deadlift", scaling_level_id: "slvl_winter_scaled", description: "Conventional or sumo deadlift. Straps and belt allowed.", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// =========================================================================
	// Publish ALL events (standalone + parent + children) and heats
	// =========================================================================
	const allTrackWorkoutIds = [
		"tw_winter_event1_fran",
		"tw_winter_event2_grace",
		"tw_winter_event3_cindy",
		"tw_winter_event4_linda",
		"tw_winter_event5_rowing",
		"tw_winter_row_2k",
		"tw_winter_row_500",
		"tw_winter_max_dubs",
		"tw_winter_event6_snatch",
		"tw_winter_snatch_ladder",
		"tw_winter_three_lift_total",
		"tw_winter_event7_sprints",
		"tw_winter_sprint_couplet",
		"tw_winter_max_deadlift",
	]
	for (const twId of allTrackWorkoutIds) {
		await client.execute(
			"UPDATE track_workouts SET event_status = 'published', heat_status = 'published' WHERE id = ?",
			[twId],
		)
	}
	console.log("  Published all 14 track workouts (event + heat status)")

	// =========================================================================
	// Sponsors — one per parent/standalone event
	// =========================================================================
	await batchInsert(client, "sponsors", [
		{ id: "spon_winter_rogue", competition_id: "comp_winter_throwdown_2025", name: "Rogue Fitness", website: "https://www.roguefitness.com", display_order: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_nobull", competition_id: "comp_winter_throwdown_2025", name: "NOBULL", website: "https://www.nobullproject.com", display_order: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_lululemon", competition_id: "comp_winter_throwdown_2025", name: "lululemon", website: "https://www.lululemon.com", display_order: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_concept2", competition_id: "comp_winter_throwdown_2025", name: "Concept2", website: "https://www.concept2.com", display_order: 3, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_eleiko", competition_id: "comp_winter_throwdown_2025", name: "Eleiko", website: "https://www.eleiko.com", display_order: 4, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_rxbar", competition_id: "comp_winter_throwdown_2025", name: "RXBAR", website: "https://www.rxbar.com", display_order: 5, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "spon_winter_bear_komplex", competition_id: "comp_winter_throwdown_2025", name: "Bear KompleX", website: "https://www.bearkomplex.com", display_order: 6, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Assign sponsors to events
	const sponsorAssignments: Record<string, string> = {
		tw_winter_event1_fran: "spon_winter_rogue",
		tw_winter_event2_grace: "spon_winter_nobull",
		tw_winter_event3_cindy: "spon_winter_lululemon",
		tw_winter_event4_linda: "spon_winter_rxbar",
		tw_winter_event5_rowing: "spon_winter_concept2",
		tw_winter_event6_snatch: "spon_winter_eleiko",
		tw_winter_event7_sprints: "spon_winter_bear_komplex",
	}
	for (const [twId, sponsorId] of Object.entries(sponsorAssignments)) {
		await client.execute(
			"UPDATE track_workouts SET sponsor_id = ? WHERE id = ?",
			[sponsorId, twId],
		)
	}
	console.log("  Assigned 7 sponsors to events")

	// =========================================================================
	// Heats + Assignments — schedule across a competition day
	// =========================================================================
	const COMP_ID = "comp_winter_throwdown_2025"
	const DIV_RX = "slvl_winter_rx"

	// RX registrations (10 athletes → 2 heats of 5)
	const rxRegs = [
		"creg_tyler_winter", "creg_nathan_winter", "creg_derek_winter",
		"creg_jordan_winter", "creg_mike_winter", "creg_ryan_winter",
		"creg_marcus_winter", "creg_alex_winter", "creg_brandon_winter",
		"creg_sarah_winter",
	]
	// Scaled registrations (10 athletes → 2 heats of 5)
	const scaledRegs = [
		"creg_lauren_winter", "creg_stephanie_winter", "creg_emma_winter",
		"creg_john_winter", "creg_kaitlyn_winter", "creg_ashley_winter",
		"creg_amanda_winter", "creg_megan_winter", "creg_nicole_winter",
		"creg_brittany_winter",
	]
	// Masters (1 athlete → 1 heat)
	const mastersRegs = ["creg_chris_winter"]

	// Scorable events (skip parent containers — heats only on scorable events)
	const scorableEvents = [
		"tw_winter_event1_fran",
		"tw_winter_event2_grace",
		"tw_winter_event3_cindy",
		"tw_winter_event4_linda",
		"tw_winter_row_2k",
		"tw_winter_row_500",
		"tw_winter_max_dubs",
		"tw_winter_snatch_ladder",
		"tw_winter_three_lift_total",
		"tw_winter_sprint_couplet",
		"tw_winter_max_deadlift",
	]

	// Build heats: 3 per scorable event (RX heat 1, RX heat 2, Scaled/Masters combined)
	// Schedule: start at 9:00 AM, 15 min per heat, 5 min buffer between events
	const heats: Array<Record<string, unknown>> = []
	const assignments: Array<Record<string, unknown>> = []
	const baseDate = new Date()
	baseDate.setDate(baseDate.getDate() - 7) // Competition was last week
	baseDate.setHours(9, 0, 0, 0)

	let heatCounter = 0
	for (let eventIdx = 0; eventIdx < scorableEvents.length; eventIdx++) {
		const twId = scorableEvents[eventIdx]
		// Each event gets 15 min per heat + 5 min buffer between events
		const eventStartMin = eventIdx * 55 // ~55 min per event (3 heats × 15 min + 10 min transition)

		// Heat 1: RX (athletes 1-5)
		const heat1Time = new Date(baseDate.getTime() + eventStartMin * 60000)
		const heat1Id = `heat_winter_${twId.replace("tw_winter_", "")}_rx1`
		heats.push({
			id: heat1Id,
			competition_id: COMP_ID,
			track_workout_id: twId,
			heat_number: 1,
			scheduled_time: heat1Time.toISOString().slice(0, 19).replace("T", " "),
			duration_minutes: 15,
			division_id: DIV_RX,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})
		for (let lane = 0; lane < 5; lane++) {
			assignments.push({
				id: `ha_${heat1Id}_${lane + 1}`,
				heat_id: heat1Id,
				registration_id: rxRegs[lane],
				lane_number: lane + 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}

		// Heat 2: RX (athletes 6-10)
		const heat2Time = new Date(heat1Time.getTime() + 15 * 60000)
		const heat2Id = `heat_winter_${twId.replace("tw_winter_", "")}_rx2`
		heats.push({
			id: heat2Id,
			competition_id: COMP_ID,
			track_workout_id: twId,
			heat_number: 2,
			scheduled_time: heat2Time.toISOString().slice(0, 19).replace("T", " "),
			duration_minutes: 15,
			division_id: DIV_RX,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})
		for (let lane = 0; lane < 5; lane++) {
			assignments.push({
				id: `ha_${heat2Id}_${lane + 1}`,
				heat_id: heat2Id,
				registration_id: rxRegs[5 + lane],
				lane_number: lane + 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}

		// Heat 3: Scaled + Masters combined (null division — mixed heat)
		const heat3Time = new Date(heat2Time.getTime() + 15 * 60000)
		const heat3Id = `heat_winter_${twId.replace("tw_winter_", "")}_sc`
		heats.push({
			id: heat3Id,
			competition_id: COMP_ID,
			track_workout_id: twId,
			heat_number: 3,
			scheduled_time: heat3Time.toISOString().slice(0, 19).replace("T", " "),
			duration_minutes: 15,
			division_id: null, // Mixed heat: scaled + masters
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})
		// Scaled athletes
		for (let lane = 0; lane < scaledRegs.length; lane++) {
			assignments.push({
				id: `ha_${heat3Id}_s${lane + 1}`,
				heat_id: heat3Id,
				registration_id: scaledRegs[lane],
				lane_number: lane + 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			})
		}
		// Masters athlete
		assignments.push({
			id: `ha_${heat3Id}_m1`,
			heat_id: heat3Id,
			registration_id: mastersRegs[0],
			lane_number: scaledRegs.length + 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})

		heatCounter += 3
	}

	await batchInsert(client, "competition_heats", heats)
	await batchInsert(client, "competition_heat_assignments", assignments)
	console.log(`  Created ${heatCounter} heats with ${assignments.length} lane assignments`)

	console.log("")
	console.log("Winter Throwdown 2025 fully set up:")
	console.log("  All 14 events published (event + heat status)")
	console.log("  7 sponsors assigned to top-level events")
	console.log("  33 heats across 11 scorable events (2 RX + 1 Scaled/Masters per event)")
	console.log("  21 athletes assigned to lanes in every heat")
}
