import type { Connection } from "mysql2/promise"
import { batchInsert, now, pastDatetime } from "../helpers"

/**
 * Compute sort key for a time-based score (lower is better / "asc" direction).
 * For "scored" status (statusOrder=0):
 *   sortKey = BigInt(ms) << 80n
 * Stored as a 38-char zero-padded decimal string.
 */
function timeSortKey(ms: number): string {
	const key = BigInt(ms) << 80n
	return key.toString().padStart(38, "0")
}

const VIDEO_URL = "https://youtube.com/watch?v=mp_HF-63eFs&themeRefresh=1"
const TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
const TIME_CAP_MS = 600_000 // 10 minutes in ms

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding video submissions (Online Qualifier 2026 - Event 1)...")

	const ts = now()

	// ─── Scores for Event 1 (Fran, time-with-cap 10 min) ────────────────────
	// Athletes: Mike (RX, 4:23), John (RX, 5:47), Sarah (RX, 6:15),
	//           Alex (Masters, 7:42), Jane (Scaled, 8:30)

	await batchInsert(client, "scores", [
		{
			id: "score_mike_online_event1",
			user_id: "usr_athlete_mike",
			team_id: TEAM_ID,
			workout_id: "wod_online_fran",
			competition_event_id: "tw_online_event1",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 263_000, // 4:23
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(263_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: "Felt great on the thrusters today!",
			recorded_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_john_online_event1",
			user_id: "usr_demo3member",
			team_id: TEAM_ID,
			workout_id: "wod_online_fran",
			competition_event_id: "tw_online_event1",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 347_000, // 5:47
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(347_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: null,
			recorded_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_sarah_online_event1",
			user_id: "usr_athlete_sarah",
			team_id: TEAM_ID,
			workout_id: "wod_online_fran",
			competition_event_id: "tw_online_event1",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 375_000, // 6:15
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(375_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: "Pull-ups slowed me down in the 15s",
			recorded_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_alex_online_event1",
			user_id: "usr_athlete_alex",
			team_id: TEAM_ID,
			workout_id: "wod_online_fran",
			competition_event_id: "tw_online_event1",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 462_000, // 7:42
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(462_000),
			scaling_level_id: "slvl_online_masters",
			as_rx: 1,
			notes: null,
			recorded_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_jane_online_event1",
			user_id: "usr_demo4member",
			team_id: TEAM_ID,
			workout_id: "wod_online_fran",
			competition_event_id: "tw_online_event1",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 510_000, // 8:30
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(510_000),
			scaling_level_id: "slvl_online_scaled",
			as_rx: 1,
			notes: "First time doing Fran RX weight, happy with the time!",
			recorded_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Video submissions for Event 1 ───────────────────────────────────────

	await batchInsert(client, "video_submissions", [
		{
			id: "vsub_mike_online_event1",
			registration_id: "creg_mike_online",
			track_workout_id: "tw_online_event1",
			user_id: "usr_athlete_mike",
			video_url: VIDEO_URL,
			notes: "Full video, camera angle shows thrusters and pull-up bar clearly",
			submitted_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_john_online_event1",
			registration_id: "creg_john_online",
			track_workout_id: "tw_online_event1",
			user_id: "usr_demo3member",
			video_url: VIDEO_URL,
			notes: null,
			submitted_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_sarah_online_event1",
			registration_id: "creg_sarah_online",
			track_workout_id: "tw_online_event1",
			user_id: "usr_athlete_sarah",
			video_url: VIDEO_URL,
			notes: "Timer visible in frame, full body in shot",
			submitted_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_alex_online_event1",
			registration_id: "creg_alex_online",
			track_workout_id: "tw_online_event1",
			user_id: "usr_athlete_alex",
			video_url: VIDEO_URL,
			notes: null,
			submitted_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_jane_online_event1",
			registration_id: "creg_jane_online",
			track_workout_id: "tw_online_event1",
			user_id: "usr_demo4member",
			video_url: VIDEO_URL,
			notes: "Used 65lb thrusters per scaled standards",
			submitted_at: pastDatetime(1),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
}
