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
