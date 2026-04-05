import type { Connection } from "mysql2/promise"
import { batchInsert, futureDatetime, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding registration questions, answers, and volunteer invitations...")

	const ts = now()
	const expiresAt = futureDatetime(90)

	// ================================================================
	// REGISTRATION QUESTIONS (athlete + volunteer)
	// ================================================================

	await batchInsert(client, "competition_registration_questions", [
		// Athlete questions for Winter Throwdown
		{
			id: "rq_tshirt",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "select",
			label: "T-Shirt Size",
			help_text: "What size t-shirt do you want?",
			options: JSON.stringify(["S", "M", "L", "XL", "XXL"]),
			required: 1,
			for_teammates: 0,
			sort_order: 0,
			question_target: "athlete",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "rq_experience",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "select",
			label: "Experience Level",
			help_text: "How long have you been competing?",
			options: JSON.stringify(["Beginner", "Intermediate", "Advanced", "Elite"]),
			required: 1,
			for_teammates: 0,
			sort_order: 1,
			question_target: "athlete",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "rq_dietary",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "text",
			label: "Dietary Restrictions",
			help_text: "Any food allergies or dietary needs?",
			options: null,
			required: 0,
			for_teammates: 0,
			sort_order: 2,
			question_target: "athlete",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "rq_emergency_phone",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "text",
			label: "Emergency Contact Phone",
			help_text: "Phone number for your emergency contact",
			options: null,
			required: 1,
			for_teammates: 0,
			sort_order: 3,
			question_target: "athlete",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Series-level athlete question (on the competition group)
		{
			id: "rq_series_travel",
			competition_id: null,
			group_id: "cgrp_box1_throwdowns_2025",
			type: "select",
			label: "Travel Reimbursement",
			help_text: "Will you need travel reimbursement?",
			options: JSON.stringify(["Yes", "No"]),
			required: 0,
			for_teammates: 0,
			sort_order: 4,
			question_target: "athlete",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Volunteer questions
		{
			id: "rq_vol_cert",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "select",
			label: "First Aid Certification",
			help_text: "Do you have a current first aid or EMT certification?",
			options: JSON.stringify(["Yes", "No"]),
			required: 1,
			for_teammates: 0,
			sort_order: 0,
			question_target: "volunteer",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "rq_vol_avail",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "select",
			label: "Day Availability",
			help_text: "Which days can you volunteer?",
			options: JSON.stringify(["Saturday Only", "Sunday Only", "Both Days"]),
			required: 1,
			for_teammates: 0,
			sort_order: 1,
			question_target: "volunteer",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "rq_vol_shirt",
			competition_id: "comp_winter_throwdown_2025",
			group_id: null,
			type: "select",
			label: "Volunteer T-Shirt Size",
			help_text: "Size for your volunteer staff shirt",
			options: JSON.stringify(["S", "M", "L", "XL", "XXL"]),
			required: 1,
			for_teammates: 0,
			sort_order: 2,
			question_target: "volunteer",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ================================================================
	// ATHLETE REGISTRATION ANSWERS
	// ================================================================

	// Use the existing registrations from 11-competition.ts
	await batchInsert(client, "competition_registration_answers", [
		// Mike (RX) — L, Advanced, no dietary, has emergency
		{ id: "ra_mike_shirt", question_id: "rq_tshirt", registration_id: "creg_mike_winter", user_id: "usr_athlete_mike", answer: "L", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_mike_exp", question_id: "rq_experience", registration_id: "creg_mike_winter", user_id: "usr_athlete_mike", answer: "Advanced", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_mike_emerg", question_id: "rq_emergency_phone", registration_id: "creg_mike_winter", user_id: "usr_athlete_mike", answer: "555-0101", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_mike_travel", question_id: "rq_series_travel", registration_id: "creg_mike_winter", user_id: "usr_athlete_mike", answer: "Yes", created_at: ts, updated_at: ts, update_counter: 0 },

		// Sarah (RX) — M, Elite, Gluten-free
		{ id: "ra_sarah_shirt", question_id: "rq_tshirt", registration_id: "creg_sarah_winter", user_id: "usr_athlete_sarah", answer: "M", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_sarah_exp", question_id: "rq_experience", registration_id: "creg_sarah_winter", user_id: "usr_athlete_sarah", answer: "Elite", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_sarah_diet", question_id: "rq_dietary", registration_id: "creg_sarah_winter", user_id: "usr_athlete_sarah", answer: "Gluten-free", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_sarah_emerg", question_id: "rq_emergency_phone", registration_id: "creg_sarah_winter", user_id: "usr_athlete_sarah", answer: "555-0202", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_sarah_travel", question_id: "rq_series_travel", registration_id: "creg_sarah_winter", user_id: "usr_athlete_sarah", answer: "Yes", created_at: ts, updated_at: ts, update_counter: 0 },

		// Alex (RX) — XL, Intermediate, Vegan
		{ id: "ra_alex_shirt", question_id: "rq_tshirt", registration_id: "creg_alex_winter", user_id: "usr_athlete_alex", answer: "XL", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_alex_exp", question_id: "rq_experience", registration_id: "creg_alex_winter", user_id: "usr_athlete_alex", answer: "Intermediate", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_alex_diet", question_id: "rq_dietary", registration_id: "creg_alex_winter", user_id: "usr_athlete_alex", answer: "Vegan", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_alex_emerg", question_id: "rq_emergency_phone", registration_id: "creg_alex_winter", user_id: "usr_athlete_alex", answer: "555-0303", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_alex_travel", question_id: "rq_series_travel", registration_id: "creg_alex_winter", user_id: "usr_athlete_alex", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },

		// Emma (Scaled) — S, Beginner, Nut allergy
		{ id: "ra_emma_shirt", question_id: "rq_tshirt", registration_id: "creg_emma_winter", user_id: "usr_athlete_emma", answer: "S", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_emma_exp", question_id: "rq_experience", registration_id: "creg_emma_winter", user_id: "usr_athlete_emma", answer: "Beginner", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_emma_diet", question_id: "rq_dietary", registration_id: "creg_emma_winter", user_id: "usr_athlete_emma", answer: "Nut allergy", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_emma_emerg", question_id: "rq_emergency_phone", registration_id: "creg_emma_winter", user_id: "usr_athlete_emma", answer: "555-0404", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_emma_travel", question_id: "rq_series_travel", registration_id: "creg_emma_winter", user_id: "usr_athlete_emma", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },

		// Ryan (RX) — L, Advanced
		{ id: "ra_ryan_shirt", question_id: "rq_tshirt", registration_id: "creg_ryan_winter", user_id: "usr_athlete_ryan", answer: "L", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_ryan_exp", question_id: "rq_experience", registration_id: "creg_ryan_winter", user_id: "usr_athlete_ryan", answer: "Advanced", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_ryan_emerg", question_id: "rq_emergency_phone", registration_id: "creg_ryan_winter", user_id: "usr_athlete_ryan", answer: "555-0505", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_ryan_travel", question_id: "rq_series_travel", registration_id: "creg_ryan_winter", user_id: "usr_athlete_ryan", answer: "Yes", created_at: ts, updated_at: ts, update_counter: 0 },

		// Chris (Masters 40+) — L, Elite
		{ id: "ra_chris_shirt", question_id: "rq_tshirt", registration_id: "creg_chris_winter", user_id: "usr_athlete_chris", answer: "L", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_chris_exp", question_id: "rq_experience", registration_id: "creg_chris_winter", user_id: "usr_athlete_chris", answer: "Elite", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_chris_emerg", question_id: "rq_emergency_phone", registration_id: "creg_chris_winter", user_id: "usr_athlete_chris", answer: "555-0606", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_chris_travel", question_id: "rq_series_travel", registration_id: "creg_chris_winter", user_id: "usr_athlete_chris", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },

		// Marcus (RX) — XXL, Intermediate, Dairy-free
		{ id: "ra_marcus_shirt", question_id: "rq_tshirt", registration_id: "creg_marcus_winter", user_id: "usr_athlete_marcus", answer: "XXL", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_marcus_exp", question_id: "rq_experience", registration_id: "creg_marcus_winter", user_id: "usr_athlete_marcus", answer: "Intermediate", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_marcus_diet", question_id: "rq_dietary", registration_id: "creg_marcus_winter", user_id: "usr_athlete_marcus", answer: "Dairy-free", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ra_marcus_emerg", question_id: "rq_emergency_phone", registration_id: "creg_marcus_winter", user_id: "usr_athlete_marcus", answer: "555-0707", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// ================================================================
	// VOLUNTEER INVITATIONS (needed to link volunteer answers)
	// ================================================================

	const volunteerInvitations = [
		{ id: "tinv_dave", user: "usr_volunteer_dave", email: "dave.martinez@volunteer.com", token: "vinv_token_dave" },
		{ id: "tinv_lisa", user: "usr_volunteer_lisa", email: "lisa.chen@volunteer.com", token: "vinv_token_lisa" },
		{ id: "tinv_tom", user: "usr_volunteer_tom", email: "tom.wilson@volunteer.com", token: "vinv_token_tom" },
		{ id: "tinv_rachel", user: "usr_volunteer_rachel", email: "rachel.kim@volunteer.com", token: "vinv_token_rachel" },
		{ id: "tinv_james", user: "usr_volunteer_james", email: "james.rodriguez@volunteer.com", token: "vinv_token_james" },
		{ id: "tinv_emily", user: "usr_volunteer_emily", email: "emily.thompson@volunteer.com", token: "vinv_token_emily" },
	]

	await batchInsert(
		client,
		"team_invitations",
		volunteerInvitations.map((v) => ({
			id: v.id,
			team_id: "team_winter_throwdown_2025",
			email: v.email,
			role_id: "volunteer",
			is_system_role: 1,
			token: v.token,
			invited_by: "usr_demo1admin",
			expires_at: expiresAt,
			accepted_at: ts,
			accepted_by: v.user,
			status: "accepted",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	// ================================================================
	// VOLUNTEER REGISTRATION ANSWERS
	// ================================================================

	await batchInsert(client, "volunteer_registration_answers", [
		// Dave — EMT cert: Yes, Both Days, L shirt
		{ id: "va_dave_cert", question_id: "rq_vol_cert", invitation_id: "tinv_dave", answer: "Yes", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_dave_avail", question_id: "rq_vol_avail", invitation_id: "tinv_dave", answer: "Both Days", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_dave_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_dave", answer: "L", created_at: ts, updated_at: ts, update_counter: 0 },

		// Lisa — No cert, Saturday Only, S shirt
		{ id: "va_lisa_cert", question_id: "rq_vol_cert", invitation_id: "tinv_lisa", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_lisa_avail", question_id: "rq_vol_avail", invitation_id: "tinv_lisa", answer: "Saturday Only", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_lisa_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_lisa", answer: "S", created_at: ts, updated_at: ts, update_counter: 0 },

		// Tom — No cert, Sunday Only, XL shirt
		{ id: "va_tom_cert", question_id: "rq_vol_cert", invitation_id: "tinv_tom", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_tom_avail", question_id: "rq_vol_avail", invitation_id: "tinv_tom", answer: "Sunday Only", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_tom_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_tom", answer: "XL", created_at: ts, updated_at: ts, update_counter: 0 },

		// Rachel — EMT cert: Yes, Both Days, M shirt
		{ id: "va_rachel_cert", question_id: "rq_vol_cert", invitation_id: "tinv_rachel", answer: "Yes", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_rachel_avail", question_id: "rq_vol_avail", invitation_id: "tinv_rachel", answer: "Both Days", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_rachel_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_rachel", answer: "M", created_at: ts, updated_at: ts, update_counter: 0 },

		// James — No cert, Both Days, L shirt
		{ id: "va_james_cert", question_id: "rq_vol_cert", invitation_id: "tinv_james", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_james_avail", question_id: "rq_vol_avail", invitation_id: "tinv_james", answer: "Both Days", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_james_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_james", answer: "L", created_at: ts, updated_at: ts, update_counter: 0 },

		// Emily — No cert, Sunday Only, S shirt
		{ id: "va_emily_cert", question_id: "rq_vol_cert", invitation_id: "tinv_emily", answer: "No", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_emily_avail", question_id: "rq_vol_avail", invitation_id: "tinv_emily", answer: "Sunday Only", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "va_emily_shirt", question_id: "rq_vol_shirt", invitation_id: "tinv_emily", answer: "S", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	console.log("  registration questions: 9 (5 athlete + 1 series + 3 volunteer)")
	console.log("  athlete answers: 31 rows (7 athletes)")
	console.log("  volunteer invitations: 6")
	console.log("  volunteer answers: 18 rows (6 volunteers)")
}
