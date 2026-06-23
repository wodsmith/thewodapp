import { createHash } from "node:crypto"
import type { Connection } from "mysql2/promise"

const EVENT_ID = "e2e_competition"
const ORGANIZER_TEAM_ID = "e2e_test_team"
const COMPETITION_TEAM_ID = "e2e_comp_team"
const SLUG = "e2e-throwdown"
const VOLUNTEER_TOKEN = "e2e-crew-demo-volunteer-schedule"

const DEMO_VOLUNTEERS = [
	["01", "Frank", "Garcia", "frank.crew.demo@test.com", ["judge", "medical"]],
	["02", "Grace", "Martinez", "grace.crew.demo@test.com", ["judge"]],
	["03", "Hank", "Brown", "hank.crew.demo@test.com", ["scorekeeper"]],
	["04", "Ivy", "Chen", "ivy.crew.demo@test.com", ["check_in"]],
	["05", "Jules", "Patel", "jules.crew.demo@test.com", ["floor_manager"]],
	["06", "Kai", "Robinson", "kai.crew.demo@test.com", ["equipment"]],
	["07", "Lena", "Nguyen", "lena.crew.demo@test.com", ["judge"]],
	["08", "Miles", "Olsen", "miles.crew.demo@test.com", ["judge"]],
	["09", "Nora", "Diaz", "nora.crew.demo@test.com", ["judge"]],
	["10", "Owen", "Reed", "owen.crew.demo@test.com", ["judge"]],
	["11", "Priya", "Shah", "priya.crew.demo@test.com", ["judge"]],
	["12", "Quinn", "Stone", "quinn.crew.demo@test.com", ["judge"]],
	["13", "Rosa", "King", "rosa.crew.demo@test.com", ["athlete_control"]],
	["14", "Sam", "Lee", "sam.crew.demo@test.com", ["equipment_team"]],
	["15", "Tara", "Brooks", "tara.crew.demo@test.com", ["staff"]],
	["16", "Uma", "Miller", "uma.crew.demo@test.com", ["emcee"]],
	["17", "Vince", "Adams", "vince.crew.demo@test.com", ["media"]],
	["18", "Wren", "Clark", "wren.crew.demo@test.com", ["head_judge", "judge"]],
] as const

const DEMO_ATHLETES = [
	["01", "Riley", "Cross", "riley.athlete.demo@test.com", "e2e_div_rx"],
	["02", "Jordan", "Lake", "jordan.athlete.demo@test.com", "e2e_div_rx"],
	["03", "Casey", "Moss", "casey.athlete.demo@test.com", "e2e_div_scaled"],
	["04", "Morgan", "Vale", "morgan.athlete.demo@test.com", "e2e_div_scaled"],
	["05", "Taylor", "Pike", "taylor.athlete.demo@test.com", "e2e_div_rx"],
	["06", "Avery", "Fields", "avery.athlete.demo@test.com", "e2e_div_rx"],
	["07", "Drew", "Hayes", "drew.athlete.demo@test.com", "e2e_div_scaled"],
	["08", "Skyler", "Wells", "skyler.athlete.demo@test.com", "e2e_div_scaled"],
] as const

const DEMO_WORKOUTS = [
	{
		trackWorkoutId: "e2e_crew_trwk_1",
		competitionEventId: "e2e_crew_cevt_1",
		workoutId: "e2e_workout_fran",
		name: "Opening Ladder",
	},
	{
		trackWorkoutId: "e2e_crew_trwk_2",
		competitionEventId: "e2e_crew_cevt_2",
		workoutId: "e2e_workout_murph",
		name: "Barbell Sprint",
	},
	{
		trackWorkoutId: "e2e_crew_trwk_3",
		competitionEventId: "e2e_crew_cevt_3",
		workoutId: "e2e_workout_cindy",
		name: "Final Chipper",
	},
] as const

const SHIFT_SPECS = [
	{
		id: "e2e_crew_shift_checkin",
		name: "Athlete Check-In",
		roleType: "check_in",
		location: "Lobby",
		capacity: 2,
		startOffsetMinutes: -60,
		durationMinutes: 120,
		volunteers: ["04", "15"],
		statuses: ["confirmed", "pending"],
	},
	{
		id: "e2e_crew_shift_floor_a",
		name: "North Floor Crew",
		roleType: "floor_manager",
		location: "North Floor",
		capacity: 2,
		startOffsetMinutes: -20,
		durationMinutes: 120,
		volunteers: ["05", "13"],
		statuses: ["checked_in", "confirmed"],
	},
	{
		id: "e2e_crew_shift_lane2_judge",
		name: "North Lane 2 Judge",
		roleType: "judge",
		location: "North Floor / Lane 2",
		capacity: 1,
		startOffsetMinutes: 20,
		durationMinutes: 70,
		volunteers: ["02"],
		statuses: ["pending"],
	},
	{
		id: "e2e_crew_shift_score",
		name: "Score Table",
		roleType: "scorekeeper",
		location: "Scoring Desk",
		capacity: 2,
		startOffsetMinutes: -10,
		durationMinutes: 150,
		volunteers: ["03", "16"],
		statuses: ["declined", "confirmed"],
	},
	{
		id: "e2e_crew_shift_equipment",
		name: "Equipment Reset",
		roleType: "equipment",
		location: "Equipment Staging",
		capacity: 3,
		startOffsetMinutes: 45,
		durationMinutes: 135,
		volunteers: ["06", "14"],
		statuses: ["pending", "confirmed"],
	},
	{
		id: "e2e_crew_shift_medical",
		name: "Medical Station",
		roleType: "medical",
		location: "Medical Tent",
		capacity: 1,
		startOffsetMinutes: -15,
		durationMinutes: 210,
		volunteers: ["01"],
		statuses: ["no_show"],
	},
	{
		id: "e2e_crew_shift_media",
		name: "Media Runner",
		roleType: "media",
		location: "Awards Backdrop",
		capacity: 1,
		startOffsetMinutes: 120,
		durationMinutes: 90,
		volunteers: ["17"],
		statuses: ["confirmed"],
	},
] as const

export const CREW_DEMO_EVENT = {
	eventId: EVENT_ID,
	slug: SLUG,
	volunteerToken: VOLUNTEER_TOKEN,
	volunteerName: "Grace Martinez",
	volunteerShiftName: "North Lane 2 Judge",
	organizerTotals: {
		volunteers: DEMO_VOLUNTEERS.length,
		assignments: 12,
	},
} as const

export async function seedCrewDemoEvent(
	connection: Connection,
	ts: string,
	passwordHash: string,
): Promise<void> {
	console.log("Seeding E2E Crew demo event...")
	await cleanupCrewDemoEvent(connection)

	const now = new Date()
	const startDate = dateStringFrom(now)
	const endDate = dateStringFrom(addMinutes(now, 24 * 60))
	const expiresAt = sqlDatetime(addMinutes(now, 14 * 24 * 60))

	await connection.execute(
		`UPDATE \`competitions\`
		 SET name = ?, description = ?, start_date = ?, end_date = ?, timezone = ?, visibility = ?, status = ?, competition_type = ?, updated_at = ?
		 WHERE id = ?`,
		[
			"E2E Crew Demo Throwdown",
			"A seeded Crew demo with staffed floors, published heats, confirmations, and day-of state.",
			startDate,
			endDate,
			"America/Denver",
			"public",
			"published",
			"in-person",
			ts,
			EVENT_ID,
		],
	)

	await connection.execute(
		`INSERT IGNORE INTO \`crew_event_settings\` (id, competition_id, crew_only, source_platform, lifecycle, concierge_status, crew_plan, crew_billing_state, crew_billing_source, crew_billing_amount_cents, crew_billing_currency, settings, created_at, updated_at, update_counter)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			"e2e_crew_event_settings",
			EVENT_ID,
			1,
			"e2e_demo",
			"ready",
			"ready",
			"self_serve",
			"comped",
			"comp",
			0,
			"usd",
			JSON.stringify({
				demo: true,
				floors: 2,
				lanes: 8,
				workouts: DEMO_WORKOUTS.map((workout) => workout.name),
			}),
			ts,
			ts,
			0,
		],
	)

	await seedAthleteRegistrations(connection, ts, passwordHash)
	await seedVolunteers(connection, ts, passwordHash, expiresAt)
	await seedWorkoutsAndHeats(connection, ts, now)
	await seedShiftAssignments(connection, ts, now, expiresAt)
	await seedJudgeAssignments(connection, ts, now, expiresAt)

	console.log(
		`  crew demo: ${DEMO_VOLUNTEERS.length} volunteers, 2 floors, 8 lanes, 3 workouts inserted`,
	)
}

async function cleanupCrewDemoEvent(connection: Connection): Promise<void> {
	const tables = [
		"crew_volunteer_history_events",
		"crew_assignment_confirmations",
		"judge_heat_assignments",
		"judge_assignment_versions",
		"competition_heat_assignments",
		"competition_heats",
		"competition_events",
		"competition_venues",
		"volunteer_shift_assignments",
		"volunteer_shifts",
		"track_workouts",
		"programming_tracks",
		"crew_event_settings",
		"volunteer_registration_answers",
		"team_invitations",
		"competition_registrations",
		"team_memberships",
		"users",
	]

	for (const table of tables) {
		await connection.execute(`DELETE FROM \`${table}\` WHERE id LIKE 'e2e_crew_%'`)
	}
	await connection.execute(
		"DELETE FROM `users` WHERE email LIKE '%.crew.demo@test.com' OR email LIKE '%.athlete.demo@test.com'",
	)
}

async function seedAthleteRegistrations(
	connection: Connection,
	ts: string,
	passwordHash: string,
): Promise<void> {
	for (const [suffix, firstName, lastName, email, divisionId] of DEMO_ATHLETES) {
		const userId = `e2e_crew_athlete_${suffix}`
		const membershipId = `e2e_crew_comp_member_${suffix}`
		const registrationId = `e2e_crew_reg_${suffix}`

		await connection.execute(
			`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[userId, firstName, lastName, email, passwordHash, "user", ts, 0, ts, ts, 0],
		)
		await connection.execute(
			`INSERT IGNORE INTO \`team_memberships\` (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[membershipId, COMPETITION_TEAM_ID, userId, "athlete", 1, 1, ts, ts, ts, 0],
		)
		await connection.execute(
			`INSERT IGNORE INTO \`competition_registrations\` (id, event_id, user_id, team_member_id, division_id, status, registered_at, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[registrationId, EVENT_ID, userId, membershipId, divisionId, "active", ts, ts, ts, 0],
		)
	}
}

async function seedVolunteers(
	connection: Connection,
	ts: string,
	passwordHash: string,
	expiresAt: string,
): Promise<void> {
	for (const [suffix, firstName, lastName, email, roleTypes] of DEMO_VOLUNTEERS) {
		const userId = `e2e_crew_vol_user_${suffix}`
		const invitationId = `e2e_crew_vol_inv_${suffix}`
		const membershipId = membershipIdFor(suffix)
		const isScheduleTokenVolunteer = suffix === "02"
		const metadata = JSON.stringify({
			volunteerRoleTypes: roleTypes,
			availability: suffix === "02" ? "all_day" : "morning",
			credentials: roleTypes.includes("medical")
				? "EMT certified"
				: roleTypes.includes("judge")
					? "L1 judge course complete"
					: null,
			signupName: `${firstName} ${lastName}`,
			signupEmail: email,
			signupPhone: `555-20${suffix}`,
			availabilityNotes: isScheduleTokenVolunteer
				? "Available all day on both competition floors."
				: null,
		})

		await connection.execute(
			`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[userId, firstName, lastName, email, passwordHash, "user", ts, 0, ts, ts, 0],
		)
		await connection.execute(
			`INSERT IGNORE INTO \`team_invitations\` (id, team_id, email, role_id, is_system_role, token, invited_by, expires_at, accepted_at, accepted_by, status, metadata, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				invitationId,
				COMPETITION_TEAM_ID,
				email,
				"volunteer",
				1,
				isScheduleTokenVolunteer
					? VOLUNTEER_TOKEN
					: `e2e-crew-demo-volunteer-${suffix}`,
				"e2e_test_user",
				expiresAt,
				ts,
				userId,
				"accepted",
				metadata,
				ts,
				ts,
				0,
			],
		)
		await connection.execute(
			`INSERT IGNORE INTO \`team_memberships\` (id, team_id, user_id, role_id, is_system_role, is_active, invited_by, invited_at, joined_at, metadata, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				membershipId,
				COMPETITION_TEAM_ID,
				userId,
				"volunteer",
				1,
				1,
				"e2e_test_user",
				ts,
				ts,
				metadata,
				ts,
				ts,
				0,
			],
		)
	}
}

async function seedWorkoutsAndHeats(
	connection: Connection,
	ts: string,
	now: Date,
): Promise<void> {
	await connection.execute(
		`INSERT IGNORE INTO \`programming_tracks\` (id, name, description, type, owner_team_id, scaling_group_id, is_public, competition_id, created_at, updated_at, update_counter)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			"e2e_crew_programming_track",
			"Crew Demo Competition Track",
			"Three-workout demo track for Crew E2E flows",
			"self_programmed",
			ORGANIZER_TEAM_ID,
			"e2e_scaling_group",
			1,
			EVENT_ID,
			ts,
			ts,
			0,
		],
	)

	for (let index = 0; index < DEMO_WORKOUTS.length; index++) {
		const workout = DEMO_WORKOUTS[index]
		await connection.execute(
			`INSERT IGNORE INTO \`track_workouts\` (id, track_id, workout_id, track_order, notes, heat_status, event_status, default_heats_count, default_lane_shift_pattern, min_heat_buffer, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				workout.trackWorkoutId,
				"e2e_crew_programming_track",
				workout.workoutId,
				index + 1,
				workout.name,
				"published",
				"published",
				2,
				"stay",
				1,
				ts,
				ts,
				0,
			],
		)
		await connection.execute(
			`INSERT IGNORE INTO \`competition_events\` (id, competition_id, track_workout_id, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[workout.competitionEventId, EVENT_ID, workout.trackWorkoutId, ts, ts, 0],
		)
	}

	const venues = [
		["e2e_crew_venue_north", "North Floor", 4, 0],
		["e2e_crew_venue_south", "South Floor", 4, 1],
	] as const
	for (const [id, name, laneCount, sortOrder] of venues) {
		await connection.execute(
			`INSERT IGNORE INTO \`competition_venues\` (id, competition_id, name, lane_count, transition_minutes, sort_order, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[id, EVENT_ID, name, laneCount, 5, sortOrder, ts, ts, 0],
		)
	}

	for (let workoutIndex = 0; workoutIndex < DEMO_WORKOUTS.length; workoutIndex++) {
		const workout = DEMO_WORKOUTS[workoutIndex]
		for (let floorIndex = 0; floorIndex < venues.length; floorIndex++) {
			const heatId = `e2e_crew_heat_${workoutIndex + 1}_${floorIndex + 1}`
			const scheduledTime = sqlDatetime(
				addMinutes(now, -15 + workoutIndex * 55 + floorIndex * 8),
			)
			const venueId = venues[floorIndex][0]
			await connection.execute(
				`INSERT IGNORE INTO \`competition_heats\` (id, competition_id, track_workout_id, venue_id, heat_number, scheduled_time, duration_minutes, schedule_published_at, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					heatId,
					EVENT_ID,
					workout.trackWorkoutId,
					venueId,
					floorIndex + 1,
					scheduledTime,
					18,
					ts,
					ts,
					ts,
					0,
				],
			)
			for (let lane = 1; lane <= 4; lane++) {
				const athleteIndex = floorIndex * 4 + lane
				await connection.execute(
					`INSERT IGNORE INTO \`competition_heat_assignments\` (id, heat_id, registration_id, lane_number, created_at, updated_at, update_counter)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[
						`e2e_crew_heat_asg_${workoutIndex + 1}_${floorIndex + 1}_${lane}`,
						heatId,
						`e2e_crew_reg_${String(athleteIndex).padStart(2, "0")}`,
						lane,
						ts,
						ts,
						0,
					],
				)
			}
		}
	}
}

async function seedShiftAssignments(
	connection: Connection,
	ts: string,
	now: Date,
	expiresAt: string,
): Promise<void> {
	for (const shift of SHIFT_SPECS) {
		await connection.execute(
			`INSERT IGNORE INTO \`volunteer_shifts\` (id, competition_id, name, role_type, start_time, end_time, location, capacity, notes, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				shift.id,
				EVENT_ID,
				shift.name,
				shift.roleType,
				sqlDatetime(addMinutes(now, shift.startOffsetMinutes)),
				sqlDatetime(addMinutes(now, shift.startOffsetMinutes + shift.durationMinutes)),
				shift.location,
				shift.capacity,
				"Seeded for the Crew client demo flow.",
				ts,
				ts,
				0,
			],
		)

		for (let index = 0; index < shift.volunteers.length; index++) {
			const suffix = shift.volunteers[index]
			const assignmentId = `e2e_crew_vsha_${shift.id.replace("e2e_crew_shift_", "")}_${index + 1}`
			const status = shift.statuses[index] ?? "pending"
			await connection.execute(
				`INSERT IGNORE INTO \`volunteer_shift_assignments\` (id, shift_id, membership_id, notes, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					assignmentId,
					shift.id,
					membershipIdFor(suffix),
					index === 0 ? "Primary owner for this block." : "Support assignment.",
					ts,
					ts,
					0,
				],
			)
			await insertConfirmation(connection, {
				id: `e2e_crew_conf_${assignmentId}`,
				assignmentType: "volunteer_shift",
				assignmentId,
				membershipId: membershipIdFor(suffix),
				invitationId: `e2e_crew_vol_inv_${suffix}`,
				email: emailForVolunteer(suffix),
				token: `e2e-crew-demo-confirm-${assignmentId}`,
				status,
				ts,
				expiresAt,
			})
		}
	}
}

async function seedJudgeAssignments(
	connection: Connection,
	ts: string,
	now: Date,
	expiresAt: string,
): Promise<void> {
	const judgeSuffixes = ["02", "07", "08", "09", "10", "11", "12", "18"]

	for (let workoutIndex = 0; workoutIndex < DEMO_WORKOUTS.length; workoutIndex++) {
		const workout = DEMO_WORKOUTS[workoutIndex]
		const versionId = `e2e_crew_jver_${workoutIndex + 1}`
		await connection.execute(
			`INSERT IGNORE INTO \`judge_assignment_versions\` (id, track_workout_id, version, published_at, published_by, notes, is_active, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				versionId,
				workout.trackWorkoutId,
				1,
				sqlDatetime(addMinutes(now, -90)),
				"e2e_test_user",
				"Seeded Crew demo judge version",
				1,
				ts,
				ts,
				0,
			],
		)

		for (let floorIndex = 0; floorIndex < 2; floorIndex++) {
			const heatId = `e2e_crew_heat_${workoutIndex + 1}_${floorIndex + 1}`
			for (let lane = 1; lane <= 4; lane++) {
				if (workoutIndex === 2 && floorIndex === 1 && lane === 4) continue
				const judgeIndex = (workoutIndex * 2 + floorIndex + lane - 1) % judgeSuffixes.length
				const suffix = judgeSuffixes[judgeIndex]
				const assignmentId = `e2e_crew_jha_${workoutIndex + 1}_${floorIndex + 1}_${lane}`
				await connection.execute(
					`INSERT IGNORE INTO \`judge_heat_assignments\` (id, heat_id, membership_id, version_id, lane_number, position, instructions, is_manual_override, created_at, updated_at, update_counter)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						assignmentId,
						heatId,
						membershipIdFor(suffix),
						versionId,
						lane,
						"judge",
						`Judge lane ${lane} on ${floorIndex === 0 ? "North" : "South"} Floor.`,
						0,
						ts,
						ts,
						0,
					],
				)
				await insertConfirmation(connection, {
					id: `e2e_crew_conf_${assignmentId}`,
					assignmentType: "judge_heat",
					assignmentId,
					membershipId: membershipIdFor(suffix),
					invitationId: `e2e_crew_vol_inv_${suffix}`,
					email: emailForVolunteer(suffix),
					token: `e2e-crew-demo-confirm-${assignmentId}`,
					status: lane === 1 && workoutIndex === 0 ? "confirmed" : "pending",
					ts,
					expiresAt,
				})
			}
		}
	}
}

async function insertConfirmation(
	connection: Connection,
	data: {
		id: string
		assignmentType: "volunteer_shift" | "judge_heat"
		assignmentId: string
		membershipId: string
		invitationId: string
		email: string
		token: string
		status: string
		ts: string
		expiresAt: string
	},
): Promise<void> {
	const respondedAt = ["confirmed", "checked_in", "declined", "change_requested", "no_show"].includes(data.status)
		? data.ts
		: null
	const responseNote =
		data.status === "declined"
			? "Seeded decline so organizers can demo response triage."
			: data.status === "no_show"
				? "Seeded no-show for event-day replacement visibility."
				: null

	await connection.execute(
		`INSERT IGNORE INTO \`crew_assignment_confirmations\` (id, competition_id, assignment_type, assignment_id, membership_id, invitation_id, email, token_hash, status, sent_at, responded_at, expires_at, response_note, reminder_count, created_at, updated_at, update_counter)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			data.id,
			EVENT_ID,
			data.assignmentType,
			data.assignmentId,
			data.membershipId,
			data.invitationId,
			data.email,
			hashToken(data.token),
			data.status,
			data.ts,
			respondedAt,
			data.expiresAt,
			responseNote,
			data.status === "pending" ? 1 : 0,
			data.ts,
			data.ts,
			0,
		],
	)
}

function membershipIdFor(suffix: string): string {
	return `e2e_crew_vol_membership_${suffix}`
}

function emailForVolunteer(suffix: string): string {
	const row = DEMO_VOLUNTEERS.find((volunteer) => volunteer[0] === suffix)
	if (!row) throw new Error(`Missing demo volunteer ${suffix}`)
	return row[3]
}

function hashToken(token: string): string {
	return `sha256:${createHash("sha256").update(token).digest("hex")}`
}

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60_000)
}

function sqlDatetime(date: Date): string {
	return date.toISOString().slice(0, 19).replace("T", " ")
}

function dateStringFrom(date: Date): string {
	return date.toISOString().slice(0, 10)
}
