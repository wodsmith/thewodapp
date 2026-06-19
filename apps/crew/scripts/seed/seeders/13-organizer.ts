import type { Connection } from "mysql2/promise"
import { batchInsert, currentTimestamp, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding organizer data...")

	const ts = now()
	const cts = currentTimestamp()
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
	const sevenDaysAgoUnix = Math.floor(sevenDaysAgo.getTime() / 1000)

	// Organizer request
	await batchInsert(client, "organizer_requests", [
		{
			id: "oreq_box1_approved",
			team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			user_id: "usr_demo1admin",
			reason: "CrossFit Box One wants to host local community competitions and throwdowns for our members and the greater fitness community.",
			status: "approved",
			admin_notes: "Approved - established CrossFit gym with good track record",
			reviewed_by: "usr_demo1admin",
			reviewed_at: ts,
			created_at: sevenDaysAgoUnix,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Entitlement type for score input
	await batchInsert(client, "entitlement_types", [
		{
			id: "competition_score_input",
			name: "Competition Score Input",
			description: "Allows a volunteer to input scores for a competition event",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Score-input entitlements for winter throwdown volunteers
	await batchInsert(client, "entitlements", [
		// Winter Throwdown volunteers
		{ id: "ent_dave_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_dave", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_lisa_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_lisa", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_tom_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_tom", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_rachel_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_rachel", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_james_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_james", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_emily_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_emily", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_kevin_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_kevin", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_maria_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_maria", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_brian_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_brian", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_sandra_winter_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_sandra", team_id: "team_winter_throwdown_2025", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		// Online Qualifier volunteers
		{ id: "ent_dave_online_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_dave", team_id: "team_online_qualifier_2026", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_lisa_online_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_lisa", team_id: "team_online_qualifier_2026", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_rachel_online_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_rachel", team_id: "team_online_qualifier_2026", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_james_online_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_james", team_id: "team_online_qualifier_2026", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ent_kevin_online_score", entitlement_type_id: "competition_score_input", user_id: "usr_volunteer_kevin", team_id: "team_online_qualifier_2026", source_type: "MANUAL", source_id: "usr_demo1admin", metadata: null, expires_at: null, deleted_at: null, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Team entitlement overrides
	await batchInsert(client, "team_entitlement_overrides", [
		{
			id: "teo_box1_competitions",
			team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			type: "limit",
			key: "max_published_competitions",
			value: "-1",
			reason: "Organizer request approved",
			expires_at: null,
			created_by: "usr_demo1admin",
			created_at: cts,
			updated_at: cts,
			update_counter: 0,
		},
		{
			id: "teo_box1_workout_tracking",
			team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			type: "feature",
			key: "workout_tracking",
			value: "true",
			reason: "Early access grant",
			expires_at: null,
			created_by: "usr_demo1admin",
			created_at: cts,
			updated_at: cts,
			update_counter: 0,
		},
		{
			id: "teo_personaladmin_workout_tracking",
			team_id: "team_personaladmin",
			type: "feature",
			key: "workout_tracking",
			value: "true",
			reason: "Early access grant",
			expires_at: null,
			created_by: "usr_demo1admin",
			created_at: cts,
			updated_at: cts,
			update_counter: 0,
		},
	])
}
