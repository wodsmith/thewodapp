import type { Connection } from "mysql2/promise"
import { batchInsert, futureDatetime, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding cohosts...")

	const ts = now()

	// Add a cohost user (Coach Smith already exists as usr_demo2coach)
	// We'll make Coach Smith a cohost on Winter Throwdown 2025
	// and also add Jane Smith (usr_demo4member) as a second cohost with limited permissions

	const fullPermissions = JSON.stringify({
		divisions: true,
		editEvents: true,
		scoringConfig: true,
		viewRegistrations: true,
		editRegistrations: true,
		waivers: true,
		schedule: true,
		locations: true,
		volunteers: true,
		results: true,
		pricing: true,
		revenue: true,
		coupons: true,
		sponsors: true,
		inviteNotes: "Full access cohost for Winter Throwdown",
	})

	const limitedPermissions = JSON.stringify({
		divisions: false,
		editEvents: false,
		scoringConfig: false,
		viewRegistrations: true,
		editRegistrations: false,
		waivers: false,
		schedule: true,
		locations: true,
		volunteers: true,
		results: true,
		pricing: false,
		revenue: false,
		coupons: false,
		sponsors: false,
		inviteNotes: "Day-of operations cohost",
	})

	// Cohost memberships on the competition event team
	await batchInsert(client, "team_memberships", [
		{
			id: "tmem_cohost_coach_winter",
			team_id: "team_winter_throwdown_2025",
			user_id: "usr_demo2coach",
			role_id: "cohost",
			is_system_role: 1,
			invited_by: "usr_demo1admin",
			invited_at: ts,
			joined_at: ts,
			expires_at: null,
			is_active: 1,
			metadata: fullPermissions,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tmem_cohost_jane_winter",
			team_id: "team_winter_throwdown_2025",
			user_id: "usr_demo4member",
			role_id: "cohost",
			is_system_role: 1,
			invited_by: "usr_demo1admin",
			invited_at: ts,
			joined_at: ts,
			expires_at: null,
			is_active: 1,
			metadata: limitedPermissions,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Accepted invitations (for audit trail)
	await batchInsert(client, "team_invitations", [
		{
			id: "tinv_cohost_coach_winter",
			team_id: "team_winter_throwdown_2025",
			email: "coach@example.com",
			role_id: "cohost",
			is_system_role: 1,
			token: "cohost-invite-token-coach-winter",
			invited_by: "usr_demo1admin",
			expires_at: futureDatetime(30),
			accepted_at: ts,
			accepted_by: "usr_demo2coach",
			status: "accepted",
			metadata: JSON.stringify({ competitionId: "comp_winter_throwdown_2025" }),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "tinv_cohost_jane_winter",
			team_id: "team_winter_throwdown_2025",
			email: "jane@example.com",
			role_id: "cohost",
			is_system_role: 1,
			token: "cohost-invite-token-jane-winter",
			invited_by: "usr_demo1admin",
			expires_at: futureDatetime(30),
			accepted_at: ts,
			accepted_by: "usr_demo4member",
			status: "accepted",
			metadata: JSON.stringify({ competitionId: "comp_winter_throwdown_2025" }),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
}
