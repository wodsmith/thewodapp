import type { Connection } from "mysql2/promise"
import {
	batchInsert,
	datetimeToUnix,
	futureDate,
	futureDatetime,
	now,
	pastDate,
	pastDatetime,
	today,
} from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding competition data...")

	const ts = now()

	// Affiliates
	await batchInsert(client, "affiliates", [
		{ id: "aff_crossfit_canvas", name: "CrossFit Canvas", location: "Austin, TX", verification_status: "verified", owner_team_id: null, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "aff_verdant_crossfit", name: "Verdant CrossFit", location: "Denver, CO", verification_status: "verified", owner_team_id: null, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Competition groups
	await batchInsert(client, "competition_groups", [
		{
			id: "cgrp_box1_throwdowns_2025",
			organizing_team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			slug: "2025-throwdown-series",
			name: "2025 Throwdown Series",
			description: "CrossFit Box One's annual community throwdown series featuring seasonal competitions throughout the year.",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Competition-specific scaling groups
	await batchInsert(client, "scaling_groups", [
		{ id: "sgrp_winter_throwdown_2025", title: "Winter Throwdown 2025 Divisions", description: "Divisions for Winter Throwdown 2025", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "sgrp_online_qualifier_2026", title: "Online Qualifier 2026 Divisions", description: "Divisions for Online Qualifier 2026", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", is_default: 0, is_system: 0, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Division levels
	await batchInsert(client, "scaling_levels", [
		// Winter Throwdown divisions
		{ id: "slvl_winter_rx", scaling_group_id: "sgrp_winter_throwdown_2025", label: "RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_winter_rx_male_partner", scaling_group_id: "sgrp_winter_throwdown_2025", label: "RX Male Partner", position: 1, team_size: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_winter_scaled", scaling_group_id: "sgrp_winter_throwdown_2025", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_winter_masters_40", scaling_group_id: "sgrp_winter_throwdown_2025", label: "Masters 40+", position: 3, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_winter_teens", scaling_group_id: "sgrp_winter_throwdown_2025", label: "Teens 14-17", position: 4, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		// Online Qualifier divisions
		{ id: "slvl_online_rx", scaling_group_id: "sgrp_online_qualifier_2026", label: "RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_online_scaled", scaling_group_id: "sgrp_online_qualifier_2026", label: "Scaled", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_online_masters", scaling_group_id: "sgrp_online_qualifier_2026", label: "Masters 40+", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Competitions
	await batchInsert(client, "competitions", [
		{
			id: "comp_winter_throwdown_2025",
			organizing_team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			competition_team_id: "team_winter_throwdown_2025",
			group_id: "cgrp_box1_throwdowns_2025",
			slug: "winter-throwdown-2025",
			name: "Winter Throwdown 2025",
			description: "Kick off the new year with CrossFit Box One's signature winter competition! Four challenging workouts testing your strength, endurance, and mental toughness. Open to all skill levels with RX, RX Male Partner (teams of 2), Scaled, Masters 40+, and Teen divisions.",
			start_date: futureDate(14),
			end_date: futureDate(14),
			registration_opens_at: today(),
			registration_closes_at: futureDate(7),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_winter_throwdown_2025"}}',
			default_registration_fee_cents: 7500,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "comp_online_qualifier_2026",
			organizing_team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
			competition_team_id: "team_online_qualifier_2026",
			group_id: "cgrp_box1_throwdowns_2025",
			slug: "online-qualifier-2026",
			name: "Online Qualifier 2026",
			description: "Complete the workouts on your own time and submit your video for verification. Athletes have a 7-day window to complete each event and submit their video.",
			start_date: today(),
			end_date: futureDate(14),
			registration_opens_at: pastDate(7),
			registration_closes_at: futureDate(7),
			timezone: "America/Denver",
			settings: '{"divisions": {"scalingGroupId": "sgrp_online_qualifier_2026"}}',
			default_registration_fee_cents: 5000,
			visibility: "public",
			status: "published",
			competition_type: "online",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Competition registrations
	function reg(
		id: string,
		eventId: string,
		userId: string,
		teamMemberId: string,
		divisionId: string,
		registeredAt: string,
		paidAt: string,
	) {
		return {
			id,
			event_id: eventId,
			user_id: userId,
			team_member_id: teamMemberId,
			division_id: divisionId,
			registered_at: datetimeToUnix(registeredAt),
			payment_status: "PAID",
			paid_at: datetimeToUnix(paidAt),
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	await batchInsert(client, "competition_registrations", [
		// Winter Throwdown - RX Division
		reg("creg_mike_winter", "comp_winter_throwdown_2025", "usr_athlete_mike", "tmem_mike_winter_throwdown", "slvl_winter_rx", "2024-12-27 10:30:00", "2024-12-27 10:31:00"),
		reg("creg_sarah_winter", "comp_winter_throwdown_2025", "usr_athlete_sarah", "tmem_sarah_winter_throwdown", "slvl_winter_rx", "2024-12-27 14:15:00", "2024-12-27 14:16:00"),
		reg("creg_alex_winter", "comp_winter_throwdown_2025", "usr_athlete_alex", "tmem_alex_winter_throwdown", "slvl_winter_rx", "2024-12-27 15:30:00", "2024-12-27 15:31:00"),
		reg("creg_ryan_winter", "comp_winter_throwdown_2025", "usr_athlete_ryan", "tmem_ryan_winter_throwdown", "slvl_winter_rx", "2024-12-28 08:00:00", "2024-12-28 08:01:00"),
		reg("creg_marcus_winter", "comp_winter_throwdown_2025", "usr_athlete_marcus", "tmem_marcus_winter_throwdown", "slvl_winter_rx", "2024-12-28 09:45:00", "2024-12-28 09:46:00"),
		reg("creg_tyler_winter", "comp_winter_throwdown_2025", "usr_athlete_tyler", "tmem_tyler_winter_throwdown", "slvl_winter_rx", "2024-12-28 11:30:00", "2024-12-28 11:31:00"),
		reg("creg_jordan_winter", "comp_winter_throwdown_2025", "usr_athlete_jordan", "tmem_jordan_winter_throwdown", "slvl_winter_rx", "2024-12-28 14:00:00", "2024-12-28 14:01:00"),
		reg("creg_nathan_winter", "comp_winter_throwdown_2025", "usr_athlete_nathan", "tmem_nathan_winter_throwdown", "slvl_winter_rx", "2024-12-29 10:00:00", "2024-12-29 10:01:00"),
		reg("creg_derek_winter", "comp_winter_throwdown_2025", "usr_athlete_derek", "tmem_derek_winter_throwdown", "slvl_winter_rx", "2024-12-29 12:30:00", "2024-12-29 12:31:00"),
		reg("creg_brandon_winter", "comp_winter_throwdown_2025", "usr_athlete_brandon", "tmem_brandon_winter_throwdown", "slvl_winter_rx", "2024-12-29 15:00:00", "2024-12-29 15:01:00"),
		// Scaled Division
		reg("creg_emma_winter", "comp_winter_throwdown_2025", "usr_athlete_emma", "tmem_emma_winter_throwdown", "slvl_winter_scaled", "2024-12-29 16:45:00", "2024-12-29 16:46:00"),
		reg("creg_john_winter", "comp_winter_throwdown_2025", "usr_demo3member", "tmem_john_winter_throwdown", "slvl_winter_scaled", "2024-12-30 11:20:00", "2024-12-30 11:21:00"),
		reg("creg_megan_winter", "comp_winter_throwdown_2025", "usr_athlete_megan", "tmem_megan_winter_throwdown", "slvl_winter_scaled", "2024-12-30 13:00:00", "2024-12-30 13:01:00"),
		reg("creg_ashley_winter", "comp_winter_throwdown_2025", "usr_athlete_ashley", "tmem_ashley_winter_throwdown", "slvl_winter_scaled", "2024-12-30 14:30:00", "2024-12-30 14:31:00"),
		reg("creg_brittany_winter", "comp_winter_throwdown_2025", "usr_athlete_brittany", "tmem_brittany_winter_throwdown", "slvl_winter_scaled", "2024-12-31 09:00:00", "2024-12-31 09:01:00"),
		reg("creg_stephanie_winter", "comp_winter_throwdown_2025", "usr_athlete_stephanie", "tmem_stephanie_winter_throwdown", "slvl_winter_scaled", "2024-12-31 10:30:00", "2024-12-31 10:31:00"),
		reg("creg_lauren_winter", "comp_winter_throwdown_2025", "usr_athlete_lauren", "tmem_lauren_winter_throwdown", "slvl_winter_scaled", "2024-12-31 12:00:00", "2024-12-31 12:01:00"),
		reg("creg_nicole_winter", "comp_winter_throwdown_2025", "usr_athlete_nicole", "tmem_nicole_winter_throwdown", "slvl_winter_scaled", "2024-12-31 14:00:00", "2024-12-31 14:01:00"),
		reg("creg_amanda_winter", "comp_winter_throwdown_2025", "usr_athlete_amanda", "tmem_amanda_winter_throwdown", "slvl_winter_scaled", "2024-12-31 15:30:00", "2024-12-31 15:31:00"),
		reg("creg_kaitlyn_winter", "comp_winter_throwdown_2025", "usr_athlete_kaitlyn", "tmem_kaitlyn_winter_throwdown", "slvl_winter_scaled", "2024-12-31 17:00:00", "2024-12-31 17:01:00"),
		// Masters 40+
		reg("creg_chris_winter", "comp_winter_throwdown_2025", "usr_athlete_chris", "tmem_chris_winter_throwdown", "slvl_winter_masters_40", "2024-12-28 09:00:00", "2024-12-28 09:01:00"),
		// Online Qualifier registrations
		{ id: "creg_john_online", event_id: "comp_online_qualifier_2026", user_id: "usr_demo3member", team_member_id: "tmem_john_online", division_id: "slvl_online_rx", registered_at: ts, payment_status: "PAID", paid_at: ts, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "creg_jane_online", event_id: "comp_online_qualifier_2026", user_id: "usr_demo4member", team_member_id: "tmem_jane_online", division_id: "slvl_online_scaled", registered_at: ts, payment_status: "PAID", paid_at: ts, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "creg_mike_online", event_id: "comp_online_qualifier_2026", user_id: "usr_athlete_mike", team_member_id: "tmem_mike_online", division_id: "slvl_online_rx", registered_at: ts, payment_status: "PAID", paid_at: ts, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "creg_sarah_online", event_id: "comp_online_qualifier_2026", user_id: "usr_athlete_sarah", team_member_id: "tmem_sarah_online", division_id: "slvl_online_rx", registered_at: ts, payment_status: "PAID", paid_at: ts, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "creg_alex_online", event_id: "comp_online_qualifier_2026", user_id: "usr_athlete_alex", team_member_id: "tmem_alex_online", division_id: "slvl_online_masters", registered_at: ts, payment_status: "PAID", paid_at: ts, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Competition events (submission windows for online qualifier)
	await batchInsert(client, "competition_events", [
		{ id: "cevt_online_event1", competition_id: "comp_online_qualifier_2026", track_workout_id: "tw_online_event1", submission_opens_at: pastDatetime(1), submission_closes_at: futureDatetime(6), created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "cevt_online_event2", competition_id: "comp_online_qualifier_2026", track_workout_id: "tw_online_event2", submission_opens_at: futureDatetime(3), submission_closes_at: futureDatetime(10), created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "cevt_online_event3", competition_id: "comp_online_qualifier_2026", track_workout_id: "tw_online_event3", submission_opens_at: futureDatetime(7), submission_closes_at: futureDatetime(14), created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
