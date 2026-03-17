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

	console.log("Sub-event seed data complete!")
	console.log("")
	console.log("Test scenarios added to Winter Throwdown 2025:")
	console.log("  Event 5: Rowing Triathlon     — 3 sub-events (2K Row, 500m Row, Max Double Unders) with mixed schemes")
	console.log("  Event 6: Snatch Ladder + Lifting — 2 sub-events (timed ladder + 3-lift total with rounds_to_score=3, score_type=sum)")
	console.log("  Event 7: Sprint Series        — 2 sub-events with different point multipliers (1x, 2x)")
	console.log("")
	console.log("Edge cases to verify:")
	console.log("  - Mixed schemes under one parent (time + reps)")
	console.log("  - Multi-round sub-event with sum aggregation (Three-Lift Total)")
	console.log("  - Unequal point multipliers (2x on deadlift)")
	console.log("  - Standalone events 1-4 should be completely unaffected")
	console.log("  - Leaderboard aggregation: parent points = sum of children")
	console.log("  - Remove parent → children cascade deleted")
	console.log("  - Reorder parent → children follow")
	console.log("  - Score entry tabs show per sub-event")
}
