import type { Client } from "@planetscale/database"
import { batchInsert, now } from "../helpers"

const CF_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvn"
const BOX1_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"

export async function seed(client: Client): Promise<void> {
	console.log("Seeding workouts...")

	const ts = now()

	function wod(
		id: string,
		name: string,
		description: string,
		scheme: string,
		scope: string,
		teamId: string,
		roundsToScore: number,
		sourceWorkoutId?: string | null,
		timeCap?: number | null,
		scoreType?: string | null,
	) {
		return {
			id,
			name,
			description,
			scheme,
			scope,
			team_id: teamId,
			rounds_to_score: roundsToScore,
			time_cap: timeCap ?? null,
			score_type: scoreType ?? defaultScoreType(scheme),
			source_workout_id: sourceWorkoutId ?? null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	/** Derive a sensible default score_type from the workout scheme */
	function defaultScoreType(scheme: string): string | null {
		switch (scheme) {
			case "time":
			case "time-with-cap":
				return "min" // faster is better
			case "rounds-reps":
			case "reps":
			case "emom":
			case "load":
			case "points":
			case "calories":
			case "meters":
			case "feet":
				return "max" // more is better
			default:
				return null
		}
	}

	// Girls workouts
	await batchInsert(client, "workouts", [
		wod("wod_amanda", "Amanda", "For time:\n\n9-7-5 reps\n\u2022 Muscle-ups\n\u2022 Squat Snatches (135/95lb)\n\nTarget: 14 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_angie", "Angie", "For time:\n\u2022 100 pull-ups\n\u2022 100 push-ups\n\u2022 100 sit-ups\n\u2022 100 squats\n\nTarget: 28 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_annie", "Annie", "For time:\n\n50-40-30-20-10 reps\n\u2022 Double-unders\n\u2022 Sit-ups\n\nTarget: 11 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_barbara", "Barbara", "For time:\n\n5 rounds\n\u2022 20 pull-ups\n\u2022 30 push-ups\n\u2022 40 sit-ups\n\u2022 50 air squats\n\u2022 3 minutes rest\n\nTarget: 8 minutes per round", "time", "public", CF_TEAM, 1),
		wod("wod_candy", "Candy", "For time:\n\n5 rounds\n\u2022 20 pull-ups\n\u2022 40 push-ups\n\u2022 60 squats\n\nTarget: 38 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_chelsea", "Chelsea", "EMOM 30:\n\u2022 5 pull-ups\n\u2022 10 push-ups\n\u2022 15 air squats\n\nTarget: 20 rounds", "emom", "public", CF_TEAM, 30),
		wod("wod_cindy", "Cindy", "AMRAP 20 minutes:\n\u2022 5 pull-ups\n\u2022 10 push-ups\n\u2022 15 air squats\n\nTarget: 12 rounds", "rounds-reps", "public", CF_TEAM, 1),
		wod("wod_diane", "Diane", "For time:\n\n21-15-9 reps\n\u2022 Deadlifts (225/155lb)\n\u2022 Handstand push-ups\n\nTarget: 4 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_elizabeth", "Elizabeth", "For time:\n\n21-15-9 reps\n\u2022 Squat Cleans (135/95lb)\n\u2022 Ring Dips\n\n", "time", "public", CF_TEAM, 1),
		wod("wod_eva", "Eva", "For time:\n\n5 rounds\n\u2022 800-meter run\n\u2022 30 kettlebell swings (2 pood)\n\u2022 30 pull-ups\n\nTarget: 70 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_fran", "Fran", "For time:\n\n21-15-9 reps\n\u2022 Thrusters (95/75lb)\n\u2022 Pull-ups\n\nTarget: 5 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_grace", "Grace", "For time:\n\u2022 30 Clean-and-Jerks (135/95lb)\n\nTarget: 8 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_gwen", "Gwen", "For time:\n\u2022 15-12-9 Clean and Jerks (unbroken)\n\u2022 Rest as needed between sets\n\nScore is weight used for all three unbroken sets. Each set must be unbroken (touch and go at floor) only; even a re-grip off the floor is a foul. Use same load for each set.\n\nTarget: 390 pounds", "load", "public", CF_TEAM, 1),
		wod("wod_helen", "Helen", "For time:\n\n3 rounds\n\u2022 400-meter run\n\u2022 21 kettlebell swings (50/35lb)\n\u2022 12 pull-ups\n\nTarget: 16 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_hope", "Hope", "AMRAP 3 rounds:\n\u2022 Burpees\n\u2022 Power snatch (75/55lb)\n\u2022 Box jump (24/20 inch)\n\u2022 Thruster (75/55lb)\n\u2022 Chest to bar Pull-ups\n\nTarget: 150 points", "points", "public", CF_TEAM, 1),
		wod("wod_isabel", "Isabel", "For time:\n\u2022 30 Snatches (135/95lb)\n\nTarget: 16 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_jackie", "Jackie", "For time:\n\u2022 1,000-meter row\n\u2022 50 thrusters (45/35lb)\n\u2022 30 pull-ups\n\nTarget: 18 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_karen", "Karen", "For time:\n\u2022 150 Wall Ball Shots (20/14lb)\n\nTarget: 15 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_kelly", "Kelly", "For time:\n\n5 rounds\n\u2022 400-meter run\n\u2022 30 box jumps (24/20 inch)\n\u2022 30 wall ball shots (20/14 lbs)\n\nTarget: 50 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_linda", "Linda", "For time:\n\n10-9-8-7-6-5-4-3-2-1 reps\n\u2022 Deadlift (1.5 BW)\n\u2022 Bench Press (BW)\n\u2022 Clean (0.75 BW)\n\nTarget: 30 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_lynne", "Lynne", "5 rounds:\n\u2022 Max reps Bench Press (body weight)\n\u2022 Pull-ups\n\nTarget: 50 reps total", "reps", "public", CF_TEAM, 5),
		wod("wod_maggie", "Maggie", "For time:\n\n5 rounds\n\u2022 20 Handstand Push-ups\n\u2022 40 Pull-ups\n\u2022 60 Pistols (alternating legs)\n\nTarget: 60 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_marguerita", "Marguerita", "For time:\n\n50 rounds\n\u2022 1 Burpee\n\u2022 1 Push-up\n\u2022 1 Jumping-jack\n\u2022 1 Sit-up\n\u2022 1 Handstand push up\n\nTarget: 25 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_mary", "Mary", "AMRAP 20 minutes:\n\u2022 5 handstand push-ups\n\u2022 10 pistols (alternating legs)\n\u2022 15 pull-ups\n\nTarget: 5 rounds", "rounds-reps", "public", CF_TEAM, 1),
		wod("wod_megan", "Megan", "For time:\n\n21-15-9 reps\n\u2022 Burpees\n\u2022 KB Swings (53/35lb)\n\u2022 Double-unders\n\nTarget: 8 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_nancy", "Nancy", "For time:\n\n5 rounds\n\u2022 400-meter run\n\u2022 15 overhead squats (95/65lb)\n\nTarget: 22 minutes", "time", "public", CF_TEAM, 1),
		wod("wod_nicole", "Nicole", "AMRAP:\n\n5 rounds\n\u2022 400-meter run\n\u2022 Max reps pull-ups\n\nTarget: 55 reps total", "reps", "public", CF_TEAM, 5),
	])

	// Remixed workouts for Winter Throwdown 2025
	await batchInsert(client, "workouts", [
		wod("wod_winter_fran", "Fran", "For time:\n\n21-15-9 reps\n\u2022 Thrusters (95/75lb)\n\u2022 Pull-ups\n\nTarget: 5 minutes", "time", "private", BOX1_TEAM, 1, "wod_fran"),
		wod("wod_winter_grace", "Grace", "For time:\n\u2022 30 Clean-and-Jerks (135/95lb)\n\nTarget: 8 minutes", "time", "private", BOX1_TEAM, 1, "wod_grace"),
		wod("wod_winter_cindy", "Cindy", "AMRAP 20 minutes:\n\u2022 5 pull-ups\n\u2022 10 push-ups\n\u2022 15 air squats\n\nTarget: 12 rounds", "rounds-reps", "private", BOX1_TEAM, 1, "wod_cindy"),
		wod("wod_winter_linda", "Linda", "For time:\n\n10-9-8-7-6-5-4-3-2-1 reps\n\u2022 Deadlift (1.5 BW)\n\u2022 Bench Press (BW)\n\u2022 Clean (0.75 BW)\n\nTarget: 30 minutes", "time", "private", BOX1_TEAM, 1, "wod_linda"),
	])

	// Online Qualifier workouts
	await batchInsert(client, "workouts", [
		wod("wod_online_fran", "Online Qualifier Event 1 - Fran", "For time:\n\n21-15-9 reps of:\n\u2022 Thrusters (95/65 lb)\n\u2022 Pull-ups\n\nTime cap: 10 minutes\n\nMovement Standards:\n- Thrusters: Full depth squat, bar finishes overhead with hips and knees fully extended\n- Pull-ups: Chin must break the horizontal plane of the bar", "time-with-cap", "private", BOX1_TEAM, 1, "wod_fran", 600),
		wod("wod_online_karen", "Online Qualifier Event 2 - Karen", "For time:\n\n150 Wall Ball Shots (20/14 lb to 10/9 ft)\n\nTime cap: 15 minutes\n\nMovement Standards:\n- Wall Ball: Hip crease must pass below knee at bottom\n- Ball must hit target at or above required height", "time-with-cap", "private", BOX1_TEAM, 1, "wod_karen", 900),
		wod("wod_online_amrap", "Online Qualifier Event 3 - Chipper AMRAP", "AMRAP 12 minutes:\n\n5 Deadlifts (225/155 lb)\n10 Box Jump Overs (24/20 in)\n15 Toes-to-Bar\n\nMovement Standards:\n- Deadlifts: Full hip and knee extension at top\n- Box Jump Overs: Two-foot takeoff, both feet must touch top of box\n- Toes-to-Bar: Both feet must touch the bar simultaneously", "rounds-reps", "private", BOX1_TEAM, 1, null, null),
	])

	// Workout tags
	const girlWorkouts = [
		"amanda", "angie", "annie", "barbara", "candy", "chelsea",
		"cindy", "diane", "elizabeth", "eva", "fran", "grace",
		"gwen", "helen", "hope", "isabel", "jackie", "karen",
		"kelly", "linda", "lynne", "maggie", "marguerita", "mary",
		"megan", "nancy", "nicole",
	]

	const workoutTags: Record<string, unknown>[] = []
	for (const name of girlWorkouts) {
		workoutTags.push(
			{ id: `wtag_${name}_girl`, workout_id: `wod_${name}`, tag_id: "tag_girl", created_at: ts, updated_at: ts, update_counter: 0 },
			{ id: `wtag_${name}_benchmark`, workout_id: `wod_${name}`, tag_id: "tag_benchmark", created_at: ts, updated_at: ts, update_counter: 0 },
		)
	}
	// Extra tags
	workoutTags.push(
		{ id: "wtag_chelsea_emom", workout_id: "wod_chelsea", tag_id: "tag_emom", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wtag_cindy_amrap", workout_id: "wod_cindy", tag_id: "tag_amrap", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wtag_jackie_chipper", workout_id: "wod_jackie", tag_id: "tag_chipper", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wtag_mary_amrap", workout_id: "wod_mary", tag_id: "tag_amrap", created_at: ts, updated_at: ts, update_counter: 0 },
	)

	await batchInsert(client, "workout_tags", workoutTags)

	// Workout movements
	await batchInsert(client, "workout_movements", [
		// Amanda
		{ id: "wm_amanda_muscleup", workout_id: "wod_amanda", movement_id: "mov_muscleup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_amanda_snatch", workout_id: "wod_amanda", movement_id: "mov_snatch", created_at: ts, updated_at: ts, update_counter: 0 },
		// Angie
		{ id: "wm_angie_pullup", workout_id: "wod_angie", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_angie_pushup", workout_id: "wod_angie", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_angie_situp", workout_id: "wod_angie", movement_id: "mov_situp", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_angie_squat", workout_id: "wod_angie", movement_id: "mov_airsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Annie
		{ id: "wm_annie_du", workout_id: "wod_annie", movement_id: "mov_doubleunder", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_annie_situp", workout_id: "wod_annie", movement_id: "mov_situp", created_at: ts, updated_at: ts, update_counter: 0 },
		// Barbara
		{ id: "wm_barbara_pullup", workout_id: "wod_barbara", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_barbara_pushup", workout_id: "wod_barbara", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_barbara_situp", workout_id: "wod_barbara", movement_id: "mov_situp", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_barbara_squat", workout_id: "wod_barbara", movement_id: "mov_airsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Candy
		{ id: "wm_candy_pullup", workout_id: "wod_candy", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_candy_pushup", workout_id: "wod_candy", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_candy_squat", workout_id: "wod_candy", movement_id: "mov_airsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Chelsea
		{ id: "wm_chelsea_pullup", workout_id: "wod_chelsea", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_chelsea_pushup", workout_id: "wod_chelsea", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_chelsea_squat", workout_id: "wod_chelsea", movement_id: "mov_airsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Cindy
		{ id: "wm_cindy_pullup", workout_id: "wod_cindy", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_cindy_pushup", workout_id: "wod_cindy", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_cindy_squat", workout_id: "wod_cindy", movement_id: "mov_airsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Diane
		{ id: "wm_diane_deadlift", workout_id: "wod_diane", movement_id: "mov_deadlift", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_diane_hspu", workout_id: "wod_diane", movement_id: "mov_hspu", created_at: ts, updated_at: ts, update_counter: 0 },
		// Elizabeth
		{ id: "wm_elizabeth_clean", workout_id: "wod_elizabeth", movement_id: "mov_clean", created_at: ts, updated_at: ts, update_counter: 0 },
		// Eva
		{ id: "wm_eva_run", workout_id: "wod_eva", movement_id: "mov_run", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_eva_kbswing", workout_id: "wod_eva", movement_id: "mov_kbswing", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_eva_pullup", workout_id: "wod_eva", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Fran
		{ id: "wm_fran_thruster", workout_id: "wod_fran", movement_id: "mov_thruster", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_fran_pullup", workout_id: "wod_fran", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Grace
		{ id: "wm_grace_cj", workout_id: "wod_grace", movement_id: "mov_cleanjerk", created_at: ts, updated_at: ts, update_counter: 0 },
		// Gwen
		{ id: "wm_gwen_cj", workout_id: "wod_gwen", movement_id: "mov_cleanjerk", created_at: ts, updated_at: ts, update_counter: 0 },
		// Helen
		{ id: "wm_helen_run", workout_id: "wod_helen", movement_id: "mov_run", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_helen_kbswing", workout_id: "wod_helen", movement_id: "mov_kbswing", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_helen_pullup", workout_id: "wod_helen", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Hope
		{ id: "wm_hope_burpee", workout_id: "wod_hope", movement_id: "mov_burpee", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_hope_powersnatch", workout_id: "wod_hope", movement_id: "mov_powersnatch", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_hope_boxjump", workout_id: "wod_hope", movement_id: "mov_boxjump", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_hope_thruster", workout_id: "wod_hope", movement_id: "mov_thruster", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_hope_ctbpullup", workout_id: "wod_hope", movement_id: "mov_ctbpullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Isabel
		{ id: "wm_isabel_snatch", workout_id: "wod_isabel", movement_id: "mov_snatch", created_at: ts, updated_at: ts, update_counter: 0 },
		// Jackie
		{ id: "wm_jackie_row", workout_id: "wod_jackie", movement_id: "mov_row", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_jackie_thruster", workout_id: "wod_jackie", movement_id: "mov_thruster", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_jackie_pullup", workout_id: "wod_jackie", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Karen
		{ id: "wm_karen_wallball", workout_id: "wod_karen", movement_id: "mov_wallball", created_at: ts, updated_at: ts, update_counter: 0 },
		// Kelly
		{ id: "wm_kelly_run", workout_id: "wod_kelly", movement_id: "mov_run", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_kelly_boxjump", workout_id: "wod_kelly", movement_id: "mov_boxjump", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_kelly_wallball", workout_id: "wod_kelly", movement_id: "mov_wallball", created_at: ts, updated_at: ts, update_counter: 0 },
		// Linda
		{ id: "wm_linda_deadlift", workout_id: "wod_linda", movement_id: "mov_deadlift", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_linda_bench", workout_id: "wod_linda", movement_id: "mov_benchpress", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_linda_clean", workout_id: "wod_linda", movement_id: "mov_clean", created_at: ts, updated_at: ts, update_counter: 0 },
		// Lynne
		{ id: "wm_lynne_bench", workout_id: "wod_lynne", movement_id: "mov_benchpress", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_lynne_pullup", workout_id: "wod_lynne", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Maggie
		{ id: "wm_maggie_hspu", workout_id: "wod_maggie", movement_id: "mov_hspu", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_maggie_pullup", workout_id: "wod_maggie", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_maggie_pistol", workout_id: "wod_maggie", movement_id: "mov_pistol", created_at: ts, updated_at: ts, update_counter: 0 },
		// Marguerita
		{ id: "wm_marguerita_burpee", workout_id: "wod_marguerita", movement_id: "mov_burpee", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_marguerita_pushup", workout_id: "wod_marguerita", movement_id: "mov_pushup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_marguerita_jumpingjack", workout_id: "wod_marguerita", movement_id: "mov_jumpingjack", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_marguerita_situp", workout_id: "wod_marguerita", movement_id: "mov_situp", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_marguerita_hspu", workout_id: "wod_marguerita", movement_id: "mov_hspu", created_at: ts, updated_at: ts, update_counter: 0 },
		// Mary
		{ id: "wm_mary_hspu", workout_id: "wod_mary", movement_id: "mov_hspu", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_mary_pistol", workout_id: "wod_mary", movement_id: "mov_pistol", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_mary_pullup", workout_id: "wod_mary", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
		// Megan
		{ id: "wm_megan_burpee", workout_id: "wod_megan", movement_id: "mov_burpee", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_megan_kbswing", workout_id: "wod_megan", movement_id: "mov_kbswing", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_megan_du", workout_id: "wod_megan", movement_id: "mov_doubleunder", created_at: ts, updated_at: ts, update_counter: 0 },
		// Nancy
		{ id: "wm_nancy_run", workout_id: "wod_nancy", movement_id: "mov_run", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_nancy_ohsquat", workout_id: "wod_nancy", movement_id: "mov_ohsquat", created_at: ts, updated_at: ts, update_counter: 0 },
		// Nicole
		{ id: "wm_nicole_run", workout_id: "wod_nicole", movement_id: "mov_run", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "wm_nicole_pullup", workout_id: "wod_nicole", movement_id: "mov_pullup", created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
