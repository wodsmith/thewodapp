import type { Client } from "@planetscale/database"
import { batchInsert, now } from "../helpers"

export async function seed(client: Client): Promise<void> {
	console.log("Seeding programming tracks...")

	const ts = now()

	// Programming tracks
	await batchInsert(client, "programming_tracks", [
		{
			id: "ptrk_girls",
			name: "Girls",
			description:
				"Classic CrossFit Girls benchmark workouts - foundational CrossFit WODs named after women",
			type: "official_third_party",
			owner_team_id: "team_cokkpu1klwo0ulfhl1iwzpvn",
			scaling_group_id: null,
			is_public: 1,
			competition_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "track_winter_throwdown_2025",
			name: "Winter Throwdown 2025 - Events",
			description: "Competition events for Winter Throwdown 2025",
			type: "team_owned",
			owner_team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			scaling_group_id: "sgrp_winter_throwdown_2025",
			is_public: 0,
			competition_id: "comp_winter_throwdown_2025",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "track_online_qualifier_2026",
			name: "Online Qualifier 2026 - Events",
			description: "Competition events for Online Qualifier 2026",
			type: "team_owned",
			owner_team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			scaling_group_id: "sgrp_online_qualifier_2026",
			is_public: 0,
			competition_id: "comp_online_qualifier_2026",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Team programming tracks
	await batchInsert(client, "team_programming_tracks", [
		{
			team_id: "team_cokkpu1klwo0ulfhl1iwzpvn",
			track_id: "ptrk_girls",
			is_active: 1,
			subscribed_at: ts,
			start_day_offset: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Track workouts (Girls)
	const girlNames = [
		"amanda", "angie", "annie", "barbara", "candy", "chelsea",
		"cindy", "diane", "elizabeth", "eva", "fran", "grace",
		"gwen", "helen", "hope", "isabel", "jackie", "karen",
		"kelly", "linda", "lynne", "maggie", "marguerita", "mary",
		"megan", "nancy", "nicole",
	]

	const girlNotes: Record<string, string> = {
		amanda: "Classic benchmark - muscle-ups and squat snatches",
		angie: "High volume bodyweight movements",
		annie: "Double-unders and sit-ups descending ladder",
		barbara: "Time with rest - stay unbroken",
		candy: "High volume upper body work",
		chelsea: "EMOM format - maintain consistency",
		cindy: "Classic AMRAP - pace yourself",
		diane: "Heavy deadlifts and handstand push-ups",
		elizabeth: "Squat cleans and ring dips",
		eva: "Long chipper - pace management critical",
		fran: "The classic sprint - fast and light",
		grace: "Pure strength endurance - 30 clean and jerks",
		gwen: "Load-based scoring - find your max unbroken weight",
		helen: "Running and upper body combo",
		hope: "Points-based scoring across 5 stations",
		isabel: "30 snatches - technical and demanding",
		jackie: "Chipper format - row, thrusters, pull-ups",
		karen: "Simple but brutal - just wall balls",
		kelly: "Mixed modal endurance workout",
		linda: "Strength ladder based on bodyweight percentages",
		lynne: "Upper body strength endurance test",
		maggie: "Advanced gymnastic movements",
		marguerita: "High volume mixed movements",
		mary: "Advanced gymnastic AMRAP",
		megan: "Fast couplet with skill component",
		nancy: "Running with overhead squats",
		nicole: "Run and max pull-ups format",
	}

	const trackWorkouts = girlNames.map((name, i) => ({
		id: `trwk_girls_${name}`,
		track_id: "ptrk_girls",
		workout_id: `wod_${name}`,
		track_order: i + 1,
		notes: girlNotes[name],
		heat_status: null,
		created_at: ts,
		updated_at: ts,
		update_counter: 0,
	}))

	await batchInsert(client, "track_workouts", trackWorkouts)

	// Competition track workouts (Winter Throwdown)
	await batchInsert(client, "track_workouts", [
		{ id: "tw_winter_event1_fran", track_id: "track_winter_throwdown_2025", workout_id: "wod_winter_fran", track_order: 1, notes: "Event 1: Fran - A classic benchmark testing barbell cycling and gymnastics under fatigue. Fast and furious!", points_multiplier: 100, heat_status: "draft", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_winter_event2_grace", track_id: "track_winter_throwdown_2025", workout_id: "wod_winter_grace", track_order: 2, notes: "Event 2: Grace - 30 clean and jerks for time. Test your barbell cycling and mental fortitude.", points_multiplier: 100, heat_status: "draft", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_winter_event3_cindy", track_id: "track_winter_throwdown_2025", workout_id: "wod_winter_cindy", track_order: 3, notes: "Event 3: Cindy - 20 minute AMRAP of pull-ups, push-ups, and squats. Pace yourself!", points_multiplier: 100, heat_status: "draft", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_winter_event4_linda", track_id: "track_winter_throwdown_2025", workout_id: "wod_winter_linda", track_order: 4, notes: "Event 4: Linda (Finals) - The ultimate test with deadlifts, bench press, and cleans. 1.5x points!", points_multiplier: 150, heat_status: "draft", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Online Qualifier track workouts
	await batchInsert(client, "track_workouts", [
		{ id: "tw_online_event1", track_id: "track_online_qualifier_2026", workout_id: "wod_online_fran", track_order: 1, notes: "Event 1: Complete Fran and submit your video within the submission window.", points_multiplier: 100, heat_status: "draft", event_status: "published", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_online_event2", track_id: "track_online_qualifier_2026", workout_id: "wod_online_karen", track_order: 2, notes: "Event 2: Complete Karen and submit your video within the submission window.", points_multiplier: 100, heat_status: "draft", event_status: "published", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tw_online_event3", track_id: "track_online_qualifier_2026", workout_id: "wod_online_amrap", track_order: 3, notes: "Event 3: Complete the AMRAP and submit your video within the submission window.", points_multiplier: 150, heat_status: "draft", event_status: "published", created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
