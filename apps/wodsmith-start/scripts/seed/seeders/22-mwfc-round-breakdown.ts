import type { Connection } from "mysql2/promise"
import { batchInsert, datetimeToUnix, now, pastDatetime } from "../helpers"
import { computeSortKey, sortKeyToString } from "../../../src/lib/scoring"

const ORGANIZING_TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
const COMPETITION_ID = "comp_online_qualifier_2026"
const SCALING_GROUP_ID = "sgrp_online_qualifier_2026"
const DIVISION_ID = "slvl_ll4ioe619mz9jru5wh9evg9g"
const TRACK_ID = "track_online_qualifier_2026"
const WORKOUT_ID = "wod_mwfc_oq_team_workout_2"
const TRACK_WORKOUT_ID = "trwk_01KNVZYB6R1CZ6YFFWB4ATP0AH"
const COMPETITION_EVENT_ID = "cevt_mwfc_oq_team_workout_2"
const TIME_CAP_MS = 18 * 60 * 1000
const REPS_PER_ROUND = 200

type SeedRow = {
	key: string
	registrationId: string
	userId: string
	firstName: string
	lastName: string
	teamName: string
	affiliate: string
	overallRank: number
	totalPoints: number
	eventRank: number
	eventPoints: number
	scoreValue: number | null
	cappedRoundCount: 0 | 1 | 2
	videoUrl: string | null
	videoSubmissionId: string | null
	reviewStatus: "pending" | "under_review" | "verified" | "adjusted"
	isDirectlyModified?: boolean
}

// Captured from the public MWFC leaderboard on 2026-05-24:
// https://wodsmith.com/compete/mwfc-mountain-west-fitness-championship-online-qualifier-2026/leaderboard?division=slvl_ll4ioe619mz9jru5wh9evg9g&event=trwk_01KNVZYB6R1CZ6YFFWB4ATP0AH
const rows: SeedRow[] = [
	{
		key: "da_boys",
		registrationId: "creg_01KPMAS322M23NRN9P3QM46J7V",
		userId: "usr_01KPMADKH3QRH8ASM5Q2NGXXC7",
		firstName: "Justin",
		lastName: "Zizumbo",
		teamName: "Da Boys",
		affiliate: "Salty Hive CrossFit",
		overallRank: 1,
		totalPoints: 12,
		eventRank: 1,
		eventPoints: 1,
		scoreValue: 2_153_000,
		cappedRoundCount: 1,
		videoUrl: "https://youtu.be/EI4nkJe0A58?si=nhoaapXzejY3OTzr",
		videoSubmissionId: "vsub_ln6s2advjm9dghm75o4kj8qn",
		reviewStatus: "verified",
	},
	{
		key: "jabroni_goon_goblins",
		registrationId: "creg_01KHP547NX4C8V4HVTXV8SJTDC",
		userId: "usr_x7ub6e05uww54xqd4l53u97o",
		firstName: "Jaryd",
		lastName: "Weakley",
		teamName: "JABRONI GOON GOBLINS",
		affiliate: "GOON HQ",
		overallRank: 2,
		totalPoints: 19,
		eventRank: 3,
		eventPoints: 3,
		scoreValue: 2_261_000,
		cappedRoundCount: 2,
		videoUrl: "https://wodproofapp.com/cloud/?v=CrgzdMBz9Cm",
		videoSubmissionId: "vsub_odgtq52ti5u1vlnt7leia2q1",
		reviewStatus: "pending",
	},
	{
		key: "twin_falls",
		registrationId: "creg_01KPH7RXM5FF6SXZ7S07DQ60F6",
		userId: "usr_01KNYZ8Z68CP4S54DB3QZS9RF6",
		firstName: "Jaxon",
		lastName: "Pearl",
		teamName: "CrossFit Twin Falls Synergy Builders",
		affiliate: "CrossFit Twin Falls",
		overallRank: 3,
		totalPoints: 21,
		eventRank: 2,
		eventPoints: 2,
		scoreValue: 2_197_000,
		cappedRoundCount: 2,
		videoUrl: "https://wodproofapp.com/cloud/?v=LdVB2NYLi3z",
		videoSubmissionId: "vsub_zci3rf3zh9vcaxo2pvlpqt9u",
		reviewStatus: "pending",
	},
	{
		key: "zhorco",
		registrationId: "creg_01KPC2A9RBXZ9DNJQ21S2AYPRP",
		userId: "usr_01KPA8F8B77SF413HX8514KEA8",
		firstName: "Zach",
		lastName: "Richardson",
		teamName: "Zhorco",
		affiliate: "Independent",
		overallRank: 4,
		totalPoints: 22,
		eventRank: 8,
		eventPoints: 8,
		scoreValue: 2_301_000,
		cappedRoundCount: 2,
		videoUrl: "https://wodproofapp.com/cloud/?v=kCjE2Ym4Flb",
		videoSubmissionId: "vsub_yb8wr1jo48vt0y9w5r5k66c8",
		reviewStatus: "adjusted",
		isDirectlyModified: true,
	},
	{
		key: "horses_dont_stop",
		registrationId: "creg_01KPP3K95FEFZFXVHWWHCEGHAA",
		userId: "usr_01KPNN5M1YJDFQ5SYDSRW43Z87",
		firstName: "Nathan",
		lastName: "Vallejo",
		teamName: "Horses Don't Stop",
		affiliate: "CrossFit Fullerton",
		overallRank: 5,
		totalPoints: 23,
		eventRank: 9,
		eventPoints: 9,
		scoreValue: 2_334_000,
		cappedRoundCount: 2,
		videoUrl: "https://youtu.be/k2_3KgMm16A",
		videoSubmissionId: "vsub_zd5nrw4ahbaulzxnfcgpchbb",
		reviewStatus: "verified",
	},
	{
		key: "silver_backs",
		registrationId: "creg_01KKED81HA33CEPW5B85VKN7YJ",
		userId: "usr_01KKED1JKVBRA49DN9M6BZ8QXK",
		firstName: "Abrham",
		lastName: "Ledesma",
		teamName: "Silver backs",
		affiliate: "The pack 208",
		overallRank: 6,
		totalPoints: 25,
		eventRank: 5,
		eventPoints: 5,
		scoreValue: 2_278_000,
		cappedRoundCount: 2,
		videoUrl:
			"https://wodproofapp.com/cloud/?v=Ja6HdOJvUcx&fbclid=PAVERFWARSldRleHRuA2FlbQIxMABzcnRjBmFwcF9pZA8xMjQwMjQ1NzQyODc0MTQAAadOsxP0ACfwvvS0IFdZQGX7_XP_iio-IETuXcXwq73r2yBEsXI03EguuG4U5w_aem_vQK5IgGUOgQkIHHpcaK0Bg",
		videoSubmissionId: "vsub_goyk9qlb7sb6lyrl7iboccpe",
		reviewStatus: "under_review",
	},
	{
		key: "noodle_boyz",
		registrationId: "creg_01KN1084S5FV2N10CPWBNRQJW6",
		userId: "usr_01KKCC0TX4X0ZA2E0SJW5MZB3S",
		firstName: "Nico",
		lastName: "Thayer",
		teamName: "Noodle Boyz",
		affiliate: "Slate Strength & Conditioning",
		overallRank: 7,
		totalPoints: 28,
		eventRank: 6,
		eventPoints: 6,
		scoreValue: 2_281_000,
		cappedRoundCount: 2,
		videoUrl: "https://youtu.be/itAela6W2g8",
		videoSubmissionId: "vsub_x6313mfzlxcsdrncnex0l9p0",
		reviewStatus: "pending",
	},
	{
		key: "heavy_breathing_bros",
		registrationId: "creg_01KJVD167EWHHR31DXC9K9RHT6",
		userId: "usr_01KJVCGYRJZC11R7MY2F97JQB0",
		firstName: "Mitchell",
		lastName: "Doheny",
		teamName: "Heavy Breathing Bros",
		affiliate: "Upstate Nevada",
		overallRank: 8,
		totalPoints: 37,
		eventRank: 4,
		eventPoints: 4,
		scoreValue: 2_268_000,
		cappedRoundCount: 2,
		videoUrl: "https://wodproofapp.com/cloud/?v=jQhnNppf7gs",
		videoSubmissionId: "vsub_le41p87d9pbli9tf3wo24kqr",
		reviewStatus: "pending",
	},
	{
		key: "pr_or_er",
		registrationId: "creg_01KKG8K9MP8JYPHVF3DXX8EYAN",
		userId: "usr_01KKG6PHZ5DHRX6YPW7KQMBC54",
		firstName: "Aaron",
		lastName: "Barnes",
		teamName: "PR or ER",
		affiliate: "Crossfit Rancho Cucamonga",
		overallRank: 8,
		totalPoints: 37,
		eventRank: 7,
		eventPoints: 7,
		scoreValue: 2_300_000,
		cappedRoundCount: 2,
		videoUrl: "https://youtu.be/xLx1H-ZdN2o?feature=shared",
		videoSubmissionId: "vsub_m5cj265oy9vwqzjgigv52nr9",
		reviewStatus: "adjusted",
		isDirectlyModified: true,
	},
	{
		key: "university_place",
		registrationId: "creg_01KJZE2CZPY85ERWQMVR9P82DK",
		userId: "usr_01KJZDFCAX5CA624N4TCWR80H2",
		firstName: "Kyong",
		lastName: "So",
		teamName: "University Place Crossfit",
		affiliate: "University Place Crossfit",
		overallRank: 10,
		totalPoints: 50,
		eventRank: 10,
		eventPoints: 10,
		scoreValue: null,
		cappedRoundCount: 0,
		videoUrl: null,
		videoSubmissionId: null,
		reviewStatus: "pending",
	},
]

function scoreId(row: SeedRow): string {
	return `score_mwfc_oq2_${row.key}`
}

function athleteTeamId(row: SeedRow): string {
	return `team_mwfc_oq2_${row.key}`
}

function teammateUserId(row: SeedRow): string {
	return `usr_mwfc_oq2_${row.key}_teammate`
}

function teamMemberId(row: SeedRow): string {
	return `tmem_mwfc_oq2_${row.key}_captain`
}

async function deleteSeedRows(client: Connection): Promise<void> {
	await client.execute(
		"DELETE FROM `video_submissions` WHERE `track_workout_id` = ?",
		[TRACK_WORKOUT_ID],
	)
	await client.execute(
		"DELETE `sr` FROM `score_rounds` `sr` INNER JOIN `scores` `s` ON `s`.`id` = `sr`.`score_id` WHERE `s`.`competition_event_id` = ?",
		[TRACK_WORKOUT_ID],
	)
	await client.execute(
		"DELETE FROM `scores` WHERE `competition_event_id` = ?",
		[TRACK_WORKOUT_ID],
	)
	await client.execute(
		`DELETE FROM \`competition_registrations\` WHERE \`id\` IN (${rows.map(() => "?").join(", ")})`,
		rows.map((row) => row.registrationId),
	)
	await client.execute("DELETE FROM `competition_events` WHERE `id` = ?", [
		COMPETITION_EVENT_ID,
	])
	await client.execute("DELETE FROM `track_workouts` WHERE `id` = ?", [
		TRACK_WORKOUT_ID,
	])
	await client.execute("DELETE FROM `workouts` WHERE `id` = ?", [WORKOUT_ID])
	await client.execute("DELETE FROM `scaling_levels` WHERE `id` = ?", [
		DIVISION_ID,
	])
}

function roundValues(row: SeedRow): Array<{
	roundNumber: number
	value: number
	status: "scored" | "cap"
	secondaryValue: number | null
}> {
	if (row.scoreValue === null) return []

	if (row.cappedRoundCount === 1) {
		const remainingReps = 1
		const roundOne = row.scoreValue - TIME_CAP_MS
		return [
			{ roundNumber: 1, value: roundOne, status: "scored", secondaryValue: null },
			{
				roundNumber: 2,
				value: TIME_CAP_MS,
				status: "cap",
				secondaryValue: REPS_PER_ROUND - remainingReps,
			},
		]
	}

	const remainingReps = Math.max(0, (row.scoreValue - 2 * TIME_CAP_MS) / 1000)
	const roundOneRemainingReps = Math.floor(remainingReps / 2)
	const roundTwoRemainingReps = remainingReps - roundOneRemainingReps

	return [
		{
			roundNumber: 1,
			value: TIME_CAP_MS,
			status: "cap",
			secondaryValue: REPS_PER_ROUND - roundOneRemainingReps,
		},
		{
			roundNumber: 2,
			value: TIME_CAP_MS,
			status: "cap",
			secondaryValue: REPS_PER_ROUND - roundTwoRemainingReps,
		},
	]
}

function aggregateScoreValue(row: SeedRow): number | null {
	const rounds = roundValues(row)
	if (rounds.length === 0) return null
	return rounds.reduce((total, round) => total + round.value, 0)
}

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding MWFC round-breakdown leaderboard validation data...")

	const ts = now()
	const reviewedAt = pastDatetime(0)

	await deleteSeedRows(client)

	await batchInsert(
		client,
		"users",
		rows.flatMap((row) => [
			{
				id: row.userId,
				first_name: row.firstName,
				last_name: row.lastName,
				email: `${row.key}.captain@mwfc-seed.local`,
				email_verified: reviewedAt,
				role: "user",
				current_credits: 0,
				gender: "male",
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			},
			{
				id: teammateUserId(row),
				first_name: `${row.firstName} Team`,
				last_name: "Partner",
				email: `${row.key}.partner@mwfc-seed.local`,
				email_verified: reviewedAt,
				role: "user",
				current_credits: 0,
				gender: "male",
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			},
		]),
	)

	await batchInsert(client, "teams", [
		...rows.map((row) => ({
			id: athleteTeamId(row),
			name: row.teamName,
			slug: `mwfc-oq2-${row.key}`,
			description: `Seeded MWFC team: ${row.teamName}`,
			type: "competition_team",
			is_personal_team: 0,
			parent_organization_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	])

	await batchInsert(
		client,
		"team_memberships",
		rows.flatMap((row) => [
			{
				id: teamMemberId(row),
				team_id: athleteTeamId(row),
				user_id: row.userId,
				role_id: "owner",
				is_system_role: 1,
				joined_at: ts,
				is_active: 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			},
			{
				id: `tmem_mwfc_oq2_${row.key}_partner`,
				team_id: athleteTeamId(row),
				user_id: teammateUserId(row),
				role_id: "member",
				is_system_role: 1,
				joined_at: ts,
				is_active: 1,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			},
		]),
	)

	await batchInsert(client, "scaling_levels", [
		{
			id: DIVISION_ID,
			scaling_group_id: SCALING_GROUP_ID,
			label: "Men's Team (M/M)- RX",
			position: 4,
			team_size: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "workouts", [
		{
			id: WORKOUT_ID,
			name: "TEAM MWFC OQ Workout #2",
			description:
				"Two scored rounds. Each round uses an 18:00 cap; capped rounds store the cap time in score_rounds.value and reps completed at cap in score_rounds.secondary_value.",
			scope: "private",
			scheme: "time-with-cap",
			score_type: "sum",
			rounds_to_score: 2,
			time_cap: TIME_CAP_MS / 1000,
			team_id: ORGANIZING_TEAM_ID,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "track_workouts", [
		{
			id: TRACK_WORKOUT_ID,
			track_id: TRACK_ID,
			workout_id: WORKOUT_ID,
			track_order: 6,
			notes: "Seeded from the public MWFC team leaderboard target event.",
			points_multiplier: 100,
			heat_status: "published",
			event_status: "published",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "competition_events", [
		{
			id: COMPETITION_EVENT_ID,
			competition_id: COMPETITION_ID,
			track_workout_id: TRACK_WORKOUT_ID,
			submission_opens_at: datetimeToUnix("2026-04-10 00:00:00"),
			submission_closes_at: datetimeToUnix("2026-04-20 23:59:59"),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(
		client,
		"competition_registrations",
		rows.map((row) => ({
			id: row.registrationId,
			event_id: COMPETITION_ID,
			user_id: row.userId,
			team_member_id: teamMemberId(row),
			division_id: DIVISION_ID,
			registered_at: datetimeToUnix("2026-03-15 12:00:00"),
			status: "active",
			team_name: row.teamName,
			captain_user_id: row.userId,
			athlete_team_id: athleteTeamId(row),
			metadata: JSON.stringify({ affiliates: { [row.userId]: row.affiliate } }),
			payment_status: "PAID",
			paid_at: datetimeToUnix("2026-03-15 12:05:00"),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	const scoredRows = rows.filter((row) => row.scoreValue !== null)

	await batchInsert(
		client,
		"scores",
		scoredRows.map((row) => {
			const value = aggregateScoreValue(row) as number
			const status = row.cappedRoundCount > 0 ? "cap" : "scored"
			return {
				id: scoreId(row),
				user_id: row.userId,
				team_id: ORGANIZING_TEAM_ID,
				workout_id: WORKOUT_ID,
				competition_event_id: TRACK_WORKOUT_ID,
				scheme: "time-with-cap",
				score_type: "sum",
				score_value: value,
				time_cap_ms: TIME_CAP_MS,
				secondary_value: null,
				status,
				status_order: status === "cap" ? 1 : 0,
				sort_key: sortKeyToString(
					computeSortKey({
						value,
						status,
						scheme: "time-with-cap",
						scoreType: "sum",
						cappedRoundCount: row.cappedRoundCount,
					}),
				),
				scaling_level_id: DIVISION_ID,
				as_rx: 1,
				notes: "Seeded from public MWFC leaderboard aggregate score.",
				recorded_at: datetimeToUnix("2026-04-20 12:00:00"),
				verification_status: row.isDirectlyModified ? "adjusted" : "verified",
				verified_at: reviewedAt,
				verified_by_user_id: "usr_demo1admin",
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			}
		}),
	)

	await batchInsert(
		client,
		"score_rounds",
		scoredRows.flatMap((row) =>
			roundValues(row).map((round) => ({
				id: `sr_mwfc_oq2_${row.key}_r${round.roundNumber}`,
				score_id: scoreId(row),
				round_number: round.roundNumber,
				value: round.value,
				scheme_override: null,
				status: round.status,
				secondary_value: round.secondaryValue,
				notes:
					round.status === "cap"
						? "Explicit cap status with reps-at-cap for ADR-0014 round-aware cap validation."
						: "Explicit scored round for ADR-0014 round-aware cap validation.",
				created_at: ts,
			})),
		),
	)

	await batchInsert(
		client,
		"video_submissions",
		scoredRows.flatMap((row) => {
			if (!row.videoUrl || !row.videoSubmissionId) return []
			return [0, 1].map((videoIndex) => ({
				id:
					videoIndex === 0
						? row.videoSubmissionId
						: `${row.videoSubmissionId}_p2`,
				registration_id: row.registrationId,
				track_workout_id: TRACK_WORKOUT_ID,
				video_index: videoIndex,
				user_id: row.userId,
				video_url: row.videoUrl,
				notes: "Seeded from public MWFC leaderboard video URL.",
				submitted_at: datetimeToUnix("2026-04-20 12:00:00"),
				review_status: row.reviewStatus,
				status_updated_at:
					row.reviewStatus === "pending" ? null : datetimeToUnix("2026-04-21 12:00:00"),
				reviewer_notes: null,
				reviewed_at:
					row.reviewStatus === "verified" || row.reviewStatus === "adjusted"
						? datetimeToUnix("2026-04-21 12:00:00")
						: null,
				reviewed_by:
					row.reviewStatus === "verified" || row.reviewStatus === "adjusted"
						? "usr_demo1admin"
						: null,
				created_at: ts,
				updated_at: ts,
				update_counter: 0,
			}))
		}),
	)

	console.log(
		`  Inserted ${scoredRows.length} MWFC scores with ${scoredRows.length * 2} round rows for ${rows.length} team registrations`,
	)
}
