import type { Connection } from "mysql2/promise"
import {
	batchInsert,
	datetimeToUnix,
	futureDatetime,
	now,
	pastDatetime,
} from "../helpers"

// Seeds the team-invite-broadcast feature against Winter Throwdown 2025:
//  - Free partner division (RX Male Partner, feeCents=0)
//  - Partner registrations with both a pending teammate invite and an accepted teammate
//  - Broadcasts covering the `all`, `division`, `volunteers`, and `pending_teammates`
//    audience filters, with recipient rows keyed by userId OR invitationId.
export async function seed(client: Connection): Promise<void> {
	console.log("Seeding broadcasts + partner invite scenarios...")

	const ts = now()
	const COMPETITION_ID = "comp_winter_throwdown_2025"
	const TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"
	const PARTNER_DIVISION_ID = "slvl_winter_rx_male_partner"
	const ORGANIZER_USER_ID = "usr_demo1admin"

	// ------------------------------------------------------------------
	// Division fee override: RX Male Partner becomes FREE for easy sign-up
	// ------------------------------------------------------------------
	await batchInsert(client, "competition_divisions", [
		{
			id: "cdfee_winter_partner_free",
			competition_id: COMPETITION_ID,
			division_id: PARTNER_DIVISION_ID,
			fee_cents: 0,
			description:
				"Free RX Male Partner division — bring a partner and test the full invite + broadcast flow.",
			max_spots: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ------------------------------------------------------------------
	// Partner scenario A: captain + pending teammate (invite unclaimed)
	// Partner scenario B: captain + accepted teammate
	// ------------------------------------------------------------------
	await batchInsert(client, "teams", [
		{
			id: "team_winter_partner_mike_ghost",
			name: "Mike & Ghost",
			slug: "mike-and-ghost-winter",
			type: "competition_team",
			description: "Mike's RX Male Partner team awaiting teammate",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: null,
		},
		{
			id: "team_winter_partner_alex_ryan",
			name: "Alex & Ryan",
			slug: "alex-and-ryan-winter",
			type: "competition_team",
			description: "Alex & Ryan's RX Male Partner team",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: null,
		},
	])

	// Athlete team memberships (captains as owner, accepted teammate as member)
	await batchInsert(client, "team_memberships", [
		{
			id: "tmem_mike_partner_winter",
			team_id: "team_winter_partner_mike_ghost",
			user_id: "usr_athlete_mike",
			role_id: "owner",
			is_system_role: 1,
			joined_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_active: 1,
			metadata: null,
		},
		{
			id: "tmem_alex_partner_winter",
			team_id: "team_winter_partner_alex_ryan",
			user_id: "usr_athlete_alex",
			role_id: "owner",
			is_system_role: 1,
			joined_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_active: 1,
			metadata: null,
		},
		{
			id: "tmem_ryan_partner_winter",
			team_id: "team_winter_partner_alex_ryan",
			user_id: "usr_athlete_ryan",
			role_id: "member",
			is_system_role: 1,
			joined_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_active: 1,
			metadata: null,
		},
	])

	// Team invitations for the unclaimed pending teammates on athlete teams
	// These are the rows that power the `pending_teammates` audience filter.
	const GHOST_INVITATION_ID = "tinv_ghost_partner_winter"
	const BACKUP_INVITATION_ID = "tinv_backup_partner_winter"
	const EXPIRES_AT = futureDatetime(30)
	await batchInsert(client, "team_invitations", [
		{
			id: GHOST_INVITATION_ID,
			team_id: "team_winter_partner_mike_ghost",
			email: "ghost.teammate@athlete.com",
			role_id: "member",
			is_system_role: 1,
			token: "tok_ghost_partner_winter_throwdown_2025",
			invited_by: "usr_athlete_mike",
			expires_at: EXPIRES_AT,
			accepted_at: null,
			accepted_by: null,
			status: "pending",
			metadata: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Second pending invite on the SAME athlete team to show the captain
		// can swap/invite multiple teammates.
		{
			id: BACKUP_INVITATION_ID,
			team_id: "team_winter_partner_mike_ghost",
			email: "backup.partner@athlete.com",
			role_id: "member",
			is_system_role: 1,
			token: "tok_backup_partner_winter_throwdown_2025",
			invited_by: "usr_athlete_mike",
			expires_at: EXPIRES_AT,
			accepted_at: null,
			accepted_by: null,
			status: "pending",
			metadata: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Partner registrations — captain rows include athleteTeamId + pendingTeammates JSON.
	const mikePending = JSON.stringify([
		{
			email: "ghost.teammate@athlete.com",
			firstName: "Ghost",
			lastName: "Rider",
		},
		{
			email: "backup.partner@athlete.com",
			firstName: "Backup",
			lastName: "Partner",
		},
	])

	await batchInsert(client, "competition_registrations", [
		// Scenario A: Mike captain, teammate still pending
		{
			id: "creg_mike_partner_winter",
			event_id: COMPETITION_ID,
			user_id: "usr_athlete_mike",
			team_member_id: "tmem_mike_partner_winter",
			division_id: PARTNER_DIVISION_ID,
			team_name: "Mike & Ghost",
			captain_user_id: "usr_athlete_mike",
			athlete_team_id: "team_winter_partner_mike_ghost",
			pending_teammates: mikePending,
			registered_at: datetimeToUnix(ts),
			status: "active",
			payment_status: "FREE",
			paid_at: datetimeToUnix(ts),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Scenario B: Alex captain, Ryan accepted
		{
			id: "creg_alex_partner_winter",
			event_id: COMPETITION_ID,
			user_id: "usr_athlete_alex",
			team_member_id: "tmem_alex_partner_winter",
			division_id: PARTNER_DIVISION_ID,
			team_name: "Alex & Ryan",
			captain_user_id: "usr_athlete_alex",
			athlete_team_id: "team_winter_partner_alex_ryan",
			pending_teammates: null,
			registered_at: datetimeToUnix(ts),
			status: "active",
			payment_status: "FREE",
			paid_at: datetimeToUnix(ts),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "creg_ryan_partner_winter",
			event_id: COMPETITION_ID,
			user_id: "usr_athlete_ryan",
			team_member_id: "tmem_ryan_partner_winter",
			division_id: PARTNER_DIVISION_ID,
			team_name: "Alex & Ryan",
			captain_user_id: "usr_athlete_alex",
			athlete_team_id: "team_winter_partner_alex_ryan",
			pending_teammates: null,
			registered_at: datetimeToUnix(ts),
			status: "active",
			payment_status: "FREE",
			paid_at: datetimeToUnix(ts),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ------------------------------------------------------------------
	// Broadcasts: one draft + three sent (all / division / pending_teammates)
	// ------------------------------------------------------------------
	const SENT_AT_ALL = pastDatetime(3)
	const SENT_AT_DIVISION = pastDatetime(2)
	const SENT_AT_PENDING = pastDatetime(1)

	await batchInsert(client, "competition_broadcasts", [
		{
			id: "bcast_winter_welcome",
			competition_id: COMPETITION_ID,
			team_id: TEAM_ID,
			title: "Welcome to Winter Throwdown 2025!",
			body: "Hey athletes — thanks for registering. Event pack, heat list, and judge briefing will drop this week. Reach out with any questions.",
			audience_filter: JSON.stringify({ type: "all" }),
			recipient_count: 0, // set below
			status: "sent",
			scheduled_at: null,
			sent_at: SENT_AT_ALL,
			created_by_id: ORGANIZER_USER_ID,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "bcast_winter_rx_briefing",
			competition_id: COMPETITION_ID,
			team_id: TEAM_ID,
			title: "RX Division: floor briefing at 8:00",
			body: "RX athletes — meet at the main floor at 8:00 sharp for the movement standards briefing. Bring your judge cards.",
			audience_filter: JSON.stringify({
				type: "division",
				divisionId: "slvl_winter_rx",
			}),
			recipient_count: 0,
			status: "sent",
			scheduled_at: null,
			sent_at: SENT_AT_DIVISION,
			created_by_id: ORGANIZER_USER_ID,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "bcast_winter_pending_nudge",
			competition_id: COMPETITION_ID,
			team_id: TEAM_ID,
			title: "Your partner invite is waiting",
			body: "You were invited to join a team for Winter Throwdown 2025. Accept your invite and finish registration so your captain can secure your heat.",
			audience_filter: JSON.stringify({ type: "pending_teammates" }),
			recipient_count: 0,
			status: "sent",
			scheduled_at: null,
			sent_at: SENT_AT_PENDING,
			created_by_id: ORGANIZER_USER_ID,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "bcast_winter_draft_schedule",
			competition_id: COMPETITION_ID,
			team_id: TEAM_ID,
			title: "Draft: final schedule",
			body: "Final schedule draft — not sent yet. Review heats and edit before sending.",
			audience_filter: JSON.stringify({ type: "all" }),
			recipient_count: 0,
			status: "draft",
			scheduled_at: null,
			sent_at: null,
			created_by_id: ORGANIZER_USER_ID,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ------------------------------------------------------------------
	// Broadcast recipients
	// ------------------------------------------------------------------
	type RecipientRow = {
		id: string
		broadcast_id: string
		registration_id: string | null
		user_id: string | null
		invitation_id: string | null
		email: string | null
		email_delivery_status: "queued" | "sent" | "failed" | "skipped"
		created_at: string
		updated_at: string
		update_counter: number
	}

	function rec(
		id: string,
		broadcastId: string,
		opts: {
			registrationId?: string | null
			userId?: string | null
			invitationId?: string | null
			email?: string | null
			status?: "queued" | "sent" | "failed" | "skipped"
		},
	): RecipientRow {
		return {
			id,
			broadcast_id: broadcastId,
			registration_id: opts.registrationId ?? null,
			user_id: opts.userId ?? null,
			invitation_id: opts.invitationId ?? null,
			email: opts.email ?? null,
			email_delivery_status: opts.status ?? "sent",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	// Audience: `all` — every registered user on winter throwdown, plus the
	// two pending partner invites (keyed by invitationId + email).
	const allRxRegs: Array<[string, string]> = [
		["creg_mike_winter", "usr_athlete_mike"],
		["creg_sarah_winter", "usr_athlete_sarah"],
		["creg_alex_winter", "usr_athlete_alex"],
		["creg_ryan_winter", "usr_athlete_ryan"],
		["creg_marcus_winter", "usr_athlete_marcus"],
		["creg_tyler_winter", "usr_athlete_tyler"],
		["creg_jordan_winter", "usr_athlete_jordan"],
		["creg_nathan_winter", "usr_athlete_nathan"],
		["creg_derek_winter", "usr_athlete_derek"],
		["creg_brandon_winter", "usr_athlete_brandon"],
	]
	const allScaledRegs: Array<[string, string]> = [
		["creg_emma_winter", "usr_athlete_emma"],
		["creg_john_winter", "usr_demo3member"],
		["creg_megan_winter", "usr_athlete_megan"],
		["creg_ashley_winter", "usr_athlete_ashley"],
		["creg_brittany_winter", "usr_athlete_brittany"],
	]
	const allPartnerRegs: Array<[string, string]> = [
		// Mike's captain reg shows up here (dedup'd by userId against Mike's RX reg,
		// so we skip it — seed keeps the RX row). Alex + Ryan partner regs map to
		// their existing RX users too.
	]

	const allRecipients: RecipientRow[] = []
	let recIdCounter = 0
	const nextId = (prefix: string) => {
		recIdCounter++
		return `brcpt_${prefix}_${String(recIdCounter).padStart(4, "0")}`
	}

	for (const [regId, userId] of [
		...allRxRegs,
		...allScaledRegs,
		...allPartnerRegs,
	]) {
		allRecipients.push(
			rec(nextId("all"), "bcast_winter_welcome", {
				registrationId: regId,
				userId,
				status: "sent",
			}),
		)
	}
	// Pending teammate invites in the `all` broadcast
	allRecipients.push(
		rec(nextId("all"), "bcast_winter_welcome", {
			registrationId: null,
			invitationId: GHOST_INVITATION_ID,
			email: "ghost.teammate@athlete.com",
			status: "sent",
		}),
		rec(nextId("all"), "bcast_winter_welcome", {
			registrationId: null,
			invitationId: BACKUP_INVITATION_ID,
			email: "backup.partner@athlete.com",
			status: "sent",
		}),
	)

	// Audience: `division` = slvl_winter_rx
	for (const [regId, userId] of allRxRegs) {
		allRecipients.push(
			rec(nextId("div"), "bcast_winter_rx_briefing", {
				registrationId: regId,
				userId,
				status: "sent",
			}),
		)
	}

	// Audience: `pending_teammates` — only invite-keyed recipients
	allRecipients.push(
		rec(nextId("pend"), "bcast_winter_pending_nudge", {
			registrationId: null,
			invitationId: GHOST_INVITATION_ID,
			email: "ghost.teammate@athlete.com",
			status: "sent",
		}),
		rec(nextId("pend"), "bcast_winter_pending_nudge", {
			registrationId: null,
			invitationId: BACKUP_INVITATION_ID,
			email: "backup.partner@athlete.com",
			status: "queued",
		}),
	)

	await batchInsert(
		client,
		"competition_broadcast_recipients",
		allRecipients as unknown as Record<string, unknown>[],
	)

	// Backfill recipient_count on each sent broadcast
	const counts = new Map<string, number>()
	for (const r of allRecipients) {
		counts.set(r.broadcast_id, (counts.get(r.broadcast_id) ?? 0) + 1)
	}
	for (const [broadcastId, count] of counts.entries()) {
		await client.execute(
			"UPDATE `competition_broadcasts` SET `recipient_count` = ? WHERE `id` = ?",
			[count, broadcastId],
		)
	}
	console.log(
		`  competition_broadcasts: set recipient_count on ${counts.size} broadcasts`,
	)
}
