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

const SEGMENT_MAX = 2n ** 40n - 1n

/**
 * Compute sort key for a desc-direction score (higher is better).
 * For "scored" status (statusOrder=0):
 *   sortKey = (SEGMENT_MAX - BigInt(value)) << 80n
 */
function descSortKey(value: number): string {
	const key = (SEGMENT_MAX - BigInt(value)) << 80n
	return key.toString().padStart(38, "0")
}

const VIDEO_URL = "https://youtube.com/watch?v=mp_HF-63eFs&themeRefresh=1"
const TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
const ADMIN_USER_ID = "usr_demo1admin"
const TIME_CAP_MS = 600_000 // 10 minutes in ms

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding video submissions (Online Qualifier 2026 - Event 1)...")

	const ts = now()

	// ─── Scores for Event 1 (Fran, time-with-cap 10 min) ────────────────────
	// Athletes: Mike (RX, 4:23 verified), John (RX, 6:00 adjusted from 5:47), Sarah (RX, 6:15 under review),
	//           Alex (Masters, 7:42 pending), Jane (Scaled, 8:30 pending)

	const reviewedAt = pastDatetime(0) // "today"

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
			verification_status: "verified",
			verified_at: reviewedAt,
			verified_by_user_id: ADMIN_USER_ID,
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
			score_value: 360_000, // adjusted from 5:47 to 6:00
			time_cap_ms: TIME_CAP_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(360_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: null,
			recorded_at: pastDatetime(1),
			verification_status: "adjusted",
			verified_at: reviewedAt,
			verified_by_user_id: ADMIN_USER_ID,
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
			review_status: "verified",
			status_updated_at: reviewedAt,
			reviewer_notes: null,
			reviewed_at: reviewedAt,
			reviewed_by: ADMIN_USER_ID,
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
			review_status: "adjusted",
			status_updated_at: reviewedAt,
			reviewer_notes: "Timer started late — adjusted time from 5:47 to 6:00",
			reviewed_at: reviewedAt,
			reviewed_by: ADMIN_USER_ID,
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
			review_status: "under_review",
			status_updated_at: reviewedAt,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
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
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
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
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Scores for Event 2 (Karen, time-with-cap 15 min) ─────────────────
	// Window just opened — only Mike and Sarah have submitted so far
	const TIME_CAP_E2_MS = 900_000 // 15 minutes in ms

	await batchInsert(client, "scores", [
		{
			id: "score_mike_online_event2",
			user_id: "usr_athlete_mike",
			team_id: TEAM_ID,
			workout_id: "wod_online_karen",
			competition_event_id: "tw_online_event2",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 485_000, // 8:05
			time_cap_ms: TIME_CAP_E2_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(485_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: "Broke it into sets of 25 after the first 50",
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_sarah_online_event2",
			user_id: "usr_athlete_sarah",
			team_id: TEAM_ID,
			workout_id: "wod_online_karen",
			competition_event_id: "tw_online_event2",
			scheme: "time-with-cap",
			score_type: "min",
			score_value: 612_000, // 10:12
			time_cap_ms: TIME_CAP_E2_MS,
			status: "scored",
			status_order: 0,
			sort_key: timeSortKey(612_000),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: null,
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Video submissions for Event 2 ───────────────────────────────────
	// All pending — window just opened, no reviews yet

	await batchInsert(client, "video_submissions", [
		{
			id: "vsub_mike_online_event2",
			registration_id: "creg_mike_online",
			track_workout_id: "tw_online_event2",
			user_id: "usr_athlete_mike",
			video_url: VIDEO_URL,
			notes: "Broke it into sets of 25, unbroken first 50",
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_sarah_online_event2",
			registration_id: "creg_sarah_online",
			track_workout_id: "tw_online_event2",
			user_id: "usr_athlete_sarah",
			video_url: VIDEO_URL,
			notes: null,
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Scores for Event 5 (Triple AMRAP, rounds-reps, rounds_to_score=3) ──
	// Tests per-round score inputs. rounds-reps encoding: rounds * 100_000 + reps
	// Mike: R1=2+15 (200015), R2=2+10 (200010), R3=2+12 (200012) → total 6+37 (600037)
	// John: R1=1+18 (100018), R2=1+15 (100015), R3=1+12 (100012) → total 3+45 (300045)
	// Sarah: R1=2+12 (200012), R2=2+8 (200008), R3=1+18 (100018) → total 5+38 (500038)
	// Team Send It (Mike captain): R1=2+10 (200010), R2=1+15 (100015), R3=2+8 (200008) → total 5+33 (500033)

	await batchInsert(client, "scores", [
		{
			id: "score_mike_online_event5",
			user_id: "usr_athlete_mike",
			team_id: TEAM_ID,
			workout_id: "wod_online_triple_amrap",
			competition_event_id: "tw_online_event5",
			scheme: "rounds-reps",
			score_type: "max",
			score_value: 600037,
			status: "scored",
			status_order: 0,
			sort_key: descSortKey(600037),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: "Consistent pacing across all 3 rounds",
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_john_online_event5",
			user_id: "usr_demo3member",
			team_id: TEAM_ID,
			workout_id: "wod_online_triple_amrap",
			competition_event_id: "tw_online_event5",
			scheme: "rounds-reps",
			score_type: "max",
			score_value: 300045,
			status: "scored",
			status_order: 0,
			sort_key: descSortKey(300045),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: null,
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_sarah_online_event5",
			user_id: "usr_athlete_sarah",
			team_id: TEAM_ID,
			workout_id: "wod_online_triple_amrap",
			competition_event_id: "tw_online_event5",
			scheme: "rounds-reps",
			score_type: "max",
			score_value: 500038,
			status: "scored",
			status_order: 0,
			sort_key: descSortKey(500038),
			scaling_level_id: "slvl_online_rx",
			as_rx: 1,
			notes: "Round 2 power cleans were rough",
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "score_mike_online_event5_team",
			user_id: "usr_athlete_mike",
			team_id: TEAM_ID,
			workout_id: "wod_online_triple_amrap",
			competition_event_id: "tw_online_event5",
			scheme: "rounds-reps",
			score_type: "max",
			score_value: 500033,
			status: "scored",
			status_order: 0,
			sort_key: descSortKey(500033),
			scaling_level_id: "slvl_online_team_rx",
			as_rx: 1,
			notes: "Team effort — alternated rounds",
			recorded_at: pastDatetime(0),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Score rounds for Event 5 (per-round breakdown) ──────────────────
	await batchInsert(client, "score_rounds", [
		// Mike individual: R1=2+15, R2=2+10, R3=2+12
		{ id: "sr_mike_e5_r1", score_id: "score_mike_online_event5", round_number: 1, value: 200015, status: "scored", created_at: ts },
		{ id: "sr_mike_e5_r2", score_id: "score_mike_online_event5", round_number: 2, value: 200010, status: "scored", created_at: ts },
		{ id: "sr_mike_e5_r3", score_id: "score_mike_online_event5", round_number: 3, value: 200012, status: "scored", created_at: ts },
		// John: R1=1+18, R2=1+15, R3=1+12
		{ id: "sr_john_e5_r1", score_id: "score_john_online_event5", round_number: 1, value: 100018, status: "scored", created_at: ts },
		{ id: "sr_john_e5_r2", score_id: "score_john_online_event5", round_number: 2, value: 100015, status: "scored", created_at: ts },
		{ id: "sr_john_e5_r3", score_id: "score_john_online_event5", round_number: 3, value: 100012, status: "scored", created_at: ts },
		// Sarah: R1=2+12, R2=2+8, R3=1+18
		{ id: "sr_sarah_e5_r1", score_id: "score_sarah_online_event5", round_number: 1, value: 200012, status: "scored", created_at: ts },
		{ id: "sr_sarah_e5_r2", score_id: "score_sarah_online_event5", round_number: 2, value: 200008, status: "scored", created_at: ts },
		{ id: "sr_sarah_e5_r3", score_id: "score_sarah_online_event5", round_number: 3, value: 100018, status: "scored", created_at: ts },
		// Team Send It (Mike captain): R1=2+10, R2=1+15, R3=2+8
		{ id: "sr_mike_team_e5_r1", score_id: "score_mike_online_event5_team", round_number: 1, value: 200010, status: "scored", created_at: ts },
		{ id: "sr_mike_team_e5_r2", score_id: "score_mike_online_event5_team", round_number: 2, value: 100015, status: "scored", created_at: ts },
		{ id: "sr_mike_team_e5_r3", score_id: "score_mike_online_event5_team", round_number: 3, value: 200008, status: "scored", created_at: ts },
	])

	// ─── Video submissions for Event 5 ───────────────────────────────────
	// Individual athletes: 1 video each. Team: 2 videos (partner 1 + partner 2)
	await batchInsert(client, "video_submissions", [
		{
			id: "vsub_mike_online_event5",
			registration_id: "creg_mike_online",
			track_workout_id: "tw_online_event5",
			video_index: 0,
			user_id: "usr_athlete_mike",
			video_url: VIDEO_URL,
			notes: "All 3 rounds filmed continuously",
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_john_online_event5",
			registration_id: "creg_john_online",
			track_workout_id: "tw_online_event5",
			video_index: 0,
			user_id: "usr_demo3member",
			video_url: VIDEO_URL,
			notes: null,
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "vsub_sarah_online_event5",
			registration_id: "creg_sarah_online",
			track_workout_id: "tw_online_event5",
			video_index: 0,
			user_id: "usr_athlete_sarah",
			video_url: VIDEO_URL,
			notes: "Timer visible, full body in frame for all rounds",
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Team Send It — Partner 1 video (Mike, captain)
		{
			id: "vsub_mike_team_online_event5_p1",
			registration_id: "creg_mike_online_team",
			track_workout_id: "tw_online_event5",
			video_index: 0,
			user_id: "usr_athlete_mike",
			video_url: VIDEO_URL,
			notes: "Partner 1 (Mike) camera angle — all 3 rounds",
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Team Send It — Partner 2 video (Ryan)
		{
			id: "vsub_mike_team_online_event5_p2",
			registration_id: "creg_mike_online_team",
			track_workout_id: "tw_online_event5",
			video_index: 1,
			user_id: "usr_athlete_mike",
			video_url: VIDEO_URL,
			notes: "Partner 2 (Ryan) camera angle — all 3 rounds",
			submitted_at: pastDatetime(0),
			review_status: "pending",
			status_updated_at: null,
			reviewer_notes: null,
			reviewed_at: null,
			reviewed_by: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ─── Score verification logs (audit trail) ─────────────────────────────
	await batchInsert(client, "score_verification_logs", [
		{
			id: "svlog_mike_verified",
			score_id: "score_mike_online_event1",
			competition_id: "comp_online_qualifier_2026",
			track_workout_id: "tw_online_event1",
			athlete_user_id: "usr_athlete_mike",
			action: "verified",
			original_score_value: null,
			original_status: null,
			original_secondary_value: null,
			original_tiebreak_value: null,
			new_score_value: null,
			new_status: null,
			new_secondary_value: null,
			new_tiebreak_value: null,
			performed_by_user_id: ADMIN_USER_ID,
			performed_at: reviewedAt,
		},
		{
			id: "svlog_john_adjusted",
			score_id: "score_john_online_event1",
			competition_id: "comp_online_qualifier_2026",
			track_workout_id: "tw_online_event1",
			athlete_user_id: "usr_demo3member",
			action: "adjusted",
			original_score_value: 347_000, // 5:47
			original_status: "scored",
			original_secondary_value: null,
			original_tiebreak_value: null,
			new_score_value: 360_000, // 6:00
			new_status: "scored",
			new_secondary_value: null,
			new_tiebreak_value: null,
			performed_by_user_id: ADMIN_USER_ID,
			performed_at: reviewedAt,
		},
	])
}
