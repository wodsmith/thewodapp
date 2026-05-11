import type { Connection } from "mysql2/promise"
import {
	batchInsert,
	futureDate,
	futureDatetime,
	now,
	pastDate,
	pastDatetime,
} from "../helpers"
import {
	computeSortKey,
	sortKeyToString,
} from "../../../src/lib/scoring/sort/sort-key"

/**
 * Seeds Phase-1 ADR-0011 invite scenarios so the organizer `/invites`
 * route has something to render without any manual DB editing.
 *
 * Creates:
 *   - A championship competition ("2026 WODsmith Invitational", future-dated)
 *     with a 5-division scaling group: Men's RX, Women's RX, Scaled, plus
 *     two team-of-2 divisions (Team RX and Team Scaled) used to test
 *     captain-claim flows that lead into team-registration forms.
 *   - A Regional Qualifier competition (past-dated) with scores in all
 *     five divisions. Men's RX has 5 athletes so a source allocating 3
 *     spots triggers the roster cutoff divider; Team RX has 3 pairs with
 *     2 spots so the team roster also shows a cutoff.
 *   - Three `competition_invite_sources` rows on the championship:
 *       1. Regional Qualifier (single-comp, global_spots=3) — drives the
 *          cutoff visual in the roster tab. Division mappings cover both
 *          indy and team divisions, so the roster aggregates team-captain
 *          rows alongside indy athletes.
 *       2. Boise Throwdown from the MWFC series (single-comp, global_spots=2)
 *          — second source, exercises the multi-source aggregator plus the
 *          "skip already qualified" dedupe (mike is in both).
 *       3. MWFC Series (series kind, global_spots=5) — demonstrates the
 *          series UI card. Roster rows depend on series_division_mappings
 *          existing, which this seeder does not set up — the card itself
 *          still renders.
 *   - `competition_invites` rows covering every lifecycle state for both
 *     individual divisions (rows 1–6) and team divisions (rows 7–11):
 *     pending source-derived, accepted_paid, expired, declined, draft
 *     bespoke, sent bespoke — applied to indy captains AND team captains.
 *
 * Depends on seed `14-series-leaderboard.ts` (MWFC group + Boise comp) and
 * `03-users.ts` (athlete users).
 */
export async function seed(client: Connection): Promise<void> {
	console.log("Seeding competition invites (Phase 1 sources)...")

	const ts = now()
	const ORGANIZING_TEAM = "team_cokkpu1klwo0ulfhl1iwzpvnbox1"

	// ════════════════════════════════════════════════════════════════════
	// 1. Championship competition — the target of all invite sources
	// ════════════════════════════════════════════════════════════════════

	await batchInsert(client, "scaling_groups", [
		{
			id: "sgrp_inv_champ",
			title: "Invitational Championship Divisions",
			team_id: ORGANIZING_TEAM,
			is_default: 0,
			is_system: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "scaling_levels", [
		{ id: "slvl_inv_champ_mrx", scaling_group_id: "sgrp_inv_champ", label: "Men's RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_champ_wrx", scaling_group_id: "sgrp_inv_champ", label: "Women's RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_champ_sc", scaling_group_id: "sgrp_inv_champ", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		// Team divisions — captain claims invite, registration form collects teammate.
		{ id: "slvl_inv_champ_team_rx", scaling_group_id: "sgrp_inv_champ", label: "Team RX (Pairs)", position: 3, team_size: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_champ_team_sc", scaling_group_id: "sgrp_inv_champ", label: "Team Scaled (Pairs)", position: 4, team_size: 2, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "teams", [
		{
			id: "team_inv_championship",
			name: "Invitational Athletes",
			slug: "invitational-athletes",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "competitions", [
		{
			id: "comp_inv_championship",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_inv_championship",
			group_id: null,
			slug: "2026-wodsmith-invitational",
			name: "2026 WODsmith Invitational",
			description:
				"Invitation-only championship. Athletes qualify from the Regional Qualifier and the MWFC Throwdown Series.",
			start_date: futureDate(60),
			end_date: futureDate(61),
			registration_opens_at: futureDate(30),
			registration_closes_at: futureDate(55),
			timezone: "America/Denver",
			settings: `{"divisions": {"scalingGroupId": "sgrp_inv_champ"}}`,
			default_registration_fee_cents: 15000,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ════════════════════════════════════════════════════════════════════
	// 2. Regional Qualifier — source competition with scored athletes
	// ════════════════════════════════════════════════════════════════════

	await batchInsert(client, "scaling_groups", [
		{
			id: "sgrp_inv_qual",
			title: "Regional Qualifier Divisions",
			team_id: ORGANIZING_TEAM,
			is_default: 0,
			is_system: 0,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "scaling_levels", [
		{ id: "slvl_inv_qual_mrx", scaling_group_id: "sgrp_inv_qual", label: "Men's RX", position: 0, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_qual_wrx", scaling_group_id: "sgrp_inv_qual", label: "Women's RX", position: 1, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_qual_sc", scaling_group_id: "sgrp_inv_qual", label: "Scaled", position: 2, team_size: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		// Team divisions on the qualifier — feed the team-of-2 championship divisions.
		{ id: "slvl_inv_qual_team_rx", scaling_group_id: "sgrp_inv_qual", label: "Team RX (Pairs)", position: 3, team_size: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "slvl_inv_qual_team_sc", scaling_group_id: "sgrp_inv_qual", label: "Team Scaled (Pairs)", position: 4, team_size: 2, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	await batchInsert(client, "teams", [
		{
			id: "team_inv_qualifier",
			name: "Regional Qualifier Athletes",
			slug: "regional-qualifier-athletes",
			type: "competition_event",
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: ORGANIZING_TEAM,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "competitions", [
		{
			id: "comp_inv_qualifier",
			organizing_team_id: ORGANIZING_TEAM,
			competition_team_id: "team_inv_qualifier",
			group_id: null,
			slug: "2026-regional-qualifier",
			name: "2026 Regional Qualifier",
			description:
				"Regional feeder event for the WODsmith Invitational. Top finishers get invited.",
			start_date: pastDate(14),
			end_date: pastDate(13),
			registration_opens_at: pastDate(45),
			registration_closes_at: pastDate(16),
			timezone: "America/Denver",
			settings: `{"divisions": {"scalingGroupId": "sgrp_inv_qual"}}`,
			default_registration_fee_cents: 10000,
			visibility: "public",
			status: "published",
			competition_type: "in-person",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Single event for the qualifier — simpler than 3 events, still sortable.
	await batchInsert(client, "workouts", [
		{
			id: "wod_inv_qual_e1",
			name: "Regional Qualifier Event 1: Fran",
			description: "21-15-9 Thrusters and Pull-ups",
			scheme: "time",
			score_type: "min",
			scope: "private",
			team_id: ORGANIZING_TEAM,
			rounds_to_score: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "programming_tracks", [
		{
			id: "track_inv_qual",
			name: "Regional Qualifier Events",
			type: "team_owned",
			owner_team_id: ORGANIZING_TEAM,
			scaling_group_id: "sgrp_inv_qual",
			is_public: 0,
			competition_id: "comp_inv_qualifier",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "track_workouts", [
		{
			id: "tw_inv_qual_e1",
			track_id: "track_inv_qual",
			workout_id: "wod_inv_qual_e1",
			track_order: 0,
			event_status: "published",
			heat_status: "published",
			points_multiplier: 100,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Athletes — 5 Men's RX (to trigger cutoff with globalSpots=3), 3 Women's RX, 2 Scaled.
	// Reuses existing seed users from 03-users.ts.
	type QualAthlete = { name: string; userId: string; division: "mrx" | "wrx" | "sc"; timeMs: number }
	const qualAthletes: QualAthlete[] = [
		{ name: "mike", userId: "usr_athlete_mike", division: "mrx", timeMs: 220000 },
		{ name: "ryan", userId: "usr_athlete_ryan", division: "mrx", timeMs: 232000 },
		{ name: "alex", userId: "usr_athlete_alex", division: "mrx", timeMs: 245000 },
		{ name: "jordan", userId: "usr_athlete_jordan", division: "mrx", timeMs: 258000 },
		{ name: "marcus", userId: "usr_athlete_marcus", division: "mrx", timeMs: 270000 },
		{ name: "sarah", userId: "usr_athlete_sarah", division: "wrx", timeMs: 248000 },
		{ name: "nicole", userId: "usr_athlete_nicole", division: "wrx", timeMs: 262000 },
		{ name: "megan", userId: "usr_athlete_megan", division: "wrx", timeMs: 281000 },
		{ name: "emma", userId: "usr_athlete_emma", division: "sc", timeMs: 325000 },
		{ name: "lauren", userId: "usr_athlete_lauren", division: "sc", timeMs: 348000 },
	]

	await batchInsert(
		client,
		"team_memberships",
		qualAthletes.map((a) => ({
			id: `mbr_inv_qual_${a.name}`,
			team_id: "team_inv_qualifier",
			user_id: a.userId,
			role_id: "member",
			is_system_role: 1,
			joined_at: ts,
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	await batchInsert(
		client,
		"competition_registrations",
		qualAthletes.map((a) => ({
			id: `reg_inv_qual_${a.name}`,
			event_id: "comp_inv_qualifier",
			user_id: a.userId,
			team_member_id: `mbr_inv_qual_${a.name}`,
			division_id: `slvl_inv_qual_${a.division}`,
			registered_at: ts,
			status: "active",
			payment_status: "FREE",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	function sk(valueMs: number): string {
		return sortKeyToString(
			computeSortKey({
				value: valueMs,
				status: "scored",
				scheme: "time",
				scoreType: "min",
			}),
		)
	}

	await batchInsert(
		client,
		"scores",
		qualAthletes.map((a) => ({
			id: `scr_inv_qual_${a.name}_e1`,
			user_id: a.userId,
			team_id: ORGANIZING_TEAM,
			workout_id: "wod_inv_qual_e1",
			competition_event_id: "tw_inv_qual_e1",
			scheme: "time",
			score_type: "min",
			score_value: a.timeMs,
			status: "scored",
			status_order: 0,
			sort_key: sk(a.timeMs),
			as_rx: 1,
			scaling_level_id: `slvl_inv_qual_${a.division}`,
			recorded_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	// ════════════════════════════════════════════════════════════════════
	// 2b. Qualifier team registrations
	//
	// Three pairs in Team RX (so a global_spots=2 mapping triggers the
	// roster cutoff divider, mirroring the indy Men's RX shape) and two
	// pairs in Team Scaled. Each team is its own `competition_team` with
	// owner=captain, member=teammate. Captains hold the score; teammates
	// register but score nothing (mirrors how partner divisions actually
	// flow — one shared team result per registration pair).
	//
	// Captains intentionally use athletes that are NOT in the indy
	// qualifier roster above, so the leaderboard doesn't double-count
	// the same email on two divisions. The unique index on
	// (event_id, user_id, division_id) would technically allow it, but
	// keeping divisions disjoint makes the seed easier to reason about.
	// ════════════════════════════════════════════════════════════════════

	type QualTeam = {
		slug: string
		name: string
		division: "team_rx" | "team_sc"
		captain: { name: string; userId: string; email: string }
		teammate: { name: string; userId: string }
		timeMs: number
	}

	const qualTeams: QualTeam[] = [
		{
			slug: "thunder",
			name: "Team Thunder",
			division: "team_rx",
			captain: { name: "tyler", userId: "usr_athlete_tyler", email: "tyler.brooks@athlete.com" },
			teammate: { name: "nathan", userId: "usr_athlete_nathan" },
			timeMs: 215000,
		},
		{
			slug: "storm",
			name: "Team Storm",
			division: "team_rx",
			captain: { name: "derek", userId: "usr_athlete_derek", email: "derek.foster@athlete.com" },
			teammate: { name: "brandon", userId: "usr_athlete_brandon" },
			timeMs: 228000,
		},
		{
			slug: "havoc",
			name: "Team Havoc",
			division: "team_rx",
			captain: { name: "chris", userId: "usr_athlete_chris", email: "chris@athlete.com" },
			teammate: { name: "demo3", userId: "usr_demo3member" },
			timeMs: 245000,
		},
		{
			slug: "grit",
			name: "Team Grit",
			division: "team_sc",
			captain: { name: "ashley", userId: "usr_athlete_ashley", email: "ashley.morgan@athlete.com" },
			teammate: { name: "brittany", userId: "usr_athlete_brittany" },
			timeMs: 320000,
		},
		{
			slug: "pulse",
			name: "Team Pulse",
			division: "team_sc",
			captain: { name: "stephanie", userId: "usr_athlete_stephanie", email: "stephanie.clark@athlete.com" },
			teammate: { name: "amanda", userId: "usr_athlete_amanda" },
			timeMs: 345000,
		},
	]

	await batchInsert(
		client,
		"teams",
		qualTeams.map((t) => ({
			id: `team_inv_qual_${t.slug}`,
			name: t.name,
			slug: `inv-qual-${t.slug}`,
			type: "competition_team",
			description: `Qualifier ${t.division === "team_rx" ? "Team RX" : "Team Scaled"} entry`,
			is_personal_team: 0,
			personal_team_owner_id: null,
			current_plan_id: null,
			parent_organization_id: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	// Captain (owner) + teammate (member) memberships per team.
	const teamMemberships = qualTeams.flatMap((t) => [
		{
			id: `tmem_inv_qual_${t.slug}_${t.captain.name}`,
			team_id: `team_inv_qual_${t.slug}`,
			user_id: t.captain.userId,
			role_id: "owner",
			is_system_role: 1,
			joined_at: ts,
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: `tmem_inv_qual_${t.slug}_${t.teammate.name}`,
			team_id: `team_inv_qual_${t.slug}`,
			user_id: t.teammate.userId,
			role_id: "member",
			is_system_role: 1,
			joined_at: ts,
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
	await batchInsert(client, "team_memberships", teamMemberships)

	// Two competition_registrations per team — one for the captain, one for
	// the teammate — both pointing at the same athlete_team_id and team_name.
	const teamRegistrations = qualTeams.flatMap((t) => [
		{
			id: `reg_inv_qual_team_${t.slug}_captain`,
			event_id: "comp_inv_qualifier",
			user_id: t.captain.userId,
			team_member_id: `tmem_inv_qual_${t.slug}_${t.captain.name}`,
			division_id: `slvl_inv_qual_${t.division}`,
			team_name: t.name,
			captain_user_id: t.captain.userId,
			athlete_team_id: `team_inv_qual_${t.slug}`,
			registered_at: ts,
			status: "active",
			payment_status: "FREE",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: `reg_inv_qual_team_${t.slug}_teammate`,
			event_id: "comp_inv_qualifier",
			user_id: t.teammate.userId,
			team_member_id: `tmem_inv_qual_${t.slug}_${t.teammate.name}`,
			division_id: `slvl_inv_qual_${t.division}`,
			team_name: t.name,
			captain_user_id: t.captain.userId,
			athlete_team_id: `team_inv_qual_${t.slug}`,
			registered_at: ts,
			status: "active",
			payment_status: "FREE",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
	await batchInsert(client, "competition_registrations", teamRegistrations)

	// One score per team — recorded under the captain's userId. Teammates
	// have no score row, mirroring partner-division convention.
	await batchInsert(
		client,
		"scores",
		qualTeams.map((t) => ({
			id: `scr_inv_qual_team_${t.slug}_e1`,
			user_id: t.captain.userId,
			team_id: ORGANIZING_TEAM,
			workout_id: "wod_inv_qual_e1",
			competition_event_id: "tw_inv_qual_e1",
			scheme: "time",
			score_type: "min",
			score_value: t.timeMs,
			status: "scored",
			status_order: 0,
			sort_key: sk(t.timeMs),
			as_rx: 1,
			scaling_level_id: `slvl_inv_qual_${t.division}`,
			recorded_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		})),
	)

	// ════════════════════════════════════════════════════════════════════
	// 3. Invite sources on the championship
	// ════════════════════════════════════════════════════════════════════

	// Division-mapping JSON shared across the three sources. `spots` is
	// per-division and overrides the source-level global_spots when set.
	const qualifierDivisionMappings = JSON.stringify([
		{ sourceDivisionId: "slvl_inv_qual_mrx", championshipDivisionId: "slvl_inv_champ_mrx", spots: 3 },
		{ sourceDivisionId: "slvl_inv_qual_wrx", championshipDivisionId: "slvl_inv_champ_wrx", spots: 2 },
		{ sourceDivisionId: "slvl_inv_qual_sc", championshipDivisionId: "slvl_inv_champ_sc", spots: 2 },
		// Team divisions: top 2 of 3 Team RX pairs (cutoff after Team Storm),
		// top 1 of 2 Team Scaled pairs (cutoff after Team Grit).
		{ sourceDivisionId: "slvl_inv_qual_team_rx", championshipDivisionId: "slvl_inv_champ_team_rx", spots: 2 },
		{ sourceDivisionId: "slvl_inv_qual_team_sc", championshipDivisionId: "slvl_inv_champ_team_sc", spots: 1 },
	])

	const boiseDivisionMappings = JSON.stringify([
		{ sourceDivisionId: "slvl_mwfc_a_mrx", championshipDivisionId: "slvl_inv_champ_mrx", spots: 2 },
		{ sourceDivisionId: "slvl_mwfc_a_wrx", championshipDivisionId: "slvl_inv_champ_wrx", spots: 2 },
		{ sourceDivisionId: "slvl_mwfc_a_sc", championshipDivisionId: "slvl_inv_champ_sc", spots: 2 },
	])

	// Series source uses Boise's scaling levels as stand-ins for the series
	// template — Phase-1 MWFC has no series_division_mappings configured, so
	// the roster rows will be empty for this source; the Sources tab still
	// renders the series card + sub-tabs placeholder.
	const mwfcDivisionMappings = JSON.stringify([
		{ sourceDivisionId: "slvl_mwfc_a_mrx", championshipDivisionId: "slvl_inv_champ_mrx" },
		{ sourceDivisionId: "slvl_mwfc_a_wrx", championshipDivisionId: "slvl_inv_champ_wrx" },
		{ sourceDivisionId: "slvl_mwfc_a_sc", championshipDivisionId: "slvl_inv_champ_sc" },
	])

	// ════════════════════════════════════════════════════════════════════
	// 4. Phase 2 invite rows — one per lifecycle state so dev can inspect
	//    every row-shape in db:studio without manual edits.
	//
	//    Tokens are deterministic so the organizer can actually click a
	//    claim link. They are clearly marked as seed-only — do not ship
	//    these to prod.
	// ════════════════════════════════════════════════════════════════════

	// Mike's source-derived pending invite (row 1) and the sponsored
	// athlete's bespoke pending invite (row 6) are the only rows that
	// keep a live `claim_token` in seed — Ryan's accepted_paid row,
	// Alex's expired row, Sarah's declined row, and the draft bespoke row
	// all null the token on entry. Tokens are stored plaintext (mirrors
	// `team_invitations.token`) so the organizer can copy the URL straight
	// from the row, and the athlete can click through to the claim page.
	const SEED_PENDING_TOKEN = "seed-invite-mike-pending-men-rx-phase2"
	const SEED_BESPOKE_SPONSOR_TOKEN =
		"seed-invite-sponsor-bespoke-women-rx-phase2"

	console.log(
		`    seed tokens — pending (mike): ${SEED_PENDING_TOKEN} / bespoke-sent (sponsor): ${SEED_BESPOKE_SPONSOR_TOKEN}`,
	)

	await batchInsert(client, "competition_invites", [
		// 1. Pending source-derived invite for mike (Men's RX, top 1 from Qualifier).
		{
			id: "cinv_seed_pending_mike",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 1,
			source_placement_label: "1st — Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_mrx",
			email: "mike@athlete.com",
			user_id: "usr_athlete_mike",
			invitee_first_name: "Mike",
			invitee_last_name: null,
			claim_token: SEED_PENDING_TOKEN,
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 2. Accepted + paid invite for ryan (Men's RX, top 2 from Qualifier).
		//    Shows the happy-path terminal state: claimToken nulled,
		//    paidAt set, claimedRegistrationId linked. activeMarker stays
		//    "active" so a second claim short-circuits to "already registered".
		{
			id: "cinv_seed_accepted_ryan",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 2,
			source_placement_label: "2nd — Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_mrx",
			email: "ryan.mitchell@athlete.com",
			user_id: "usr_athlete_ryan",
			invitee_first_name: "Ryan",
			invitee_last_name: null,
			claim_token: null, // nulled on terminal transition
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "accepted_paid",
			paid_at: now(),
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null, // real reg wired up in Phase 2 sub-arc C
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active", // stays active for paid
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 3. Expired invite for a third Men's RX athlete. activeMarker nulled
		//    so the slot can be re-invited without colliding on the unique index.
		{
			id: "cinv_seed_expired_alex",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 3,
			source_placement_label: "3rd — Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_mrx",
			email: "alex.turner@athlete.com",
			user_id: "usr_athlete_alex",
			invitee_first_name: "Alex",
			invitee_last_name: null,
			claim_token: null,
			expires_at: pastDatetime(2),
			send_attempt: 1,
			status: "expired",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: null, // nulled on terminal transition
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 4. Declined invite for sarah (Women's RX top 1).
		{
			id: "cinv_seed_declined_sarah",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 1,
			source_placement_label: "1st — Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_wrx",
			email: "sarah@athlete.com",
			user_id: "usr_athlete_sarah",
			invitee_first_name: "Sarah",
			invitee_last_name: null,
			claim_token: null,
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "declined",
			paid_at: null,
			declined_at: now(),
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 5. Draft bespoke invite — organizer staged but hasn't sent yet.
		//    activeMarker = "active" so the unique-active index blocks
		//    duplicate staging; claim token is still NULL.
		{
			id: "cinv_seed_bespoke_draft_champion",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "bespoke",
			source_id: null,
			source_competition_id: null,
			source_placement: null,
			source_placement_label: null,
			bespoke_reason: "Past champion",
			championship_division_id: "slvl_inv_champ_mrx",
			email: "returning-champ@example.com",
			user_id: null,
			invitee_first_name: "Returning",
			invitee_last_name: "Champion",
			claim_token: null,
			expires_at: null,
			send_attempt: 0,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "skipped",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 6. Bespoke invite already sent to a sponsored athlete (pending).
		{
			id: "cinv_seed_bespoke_sent_sponsor",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "bespoke",
			source_id: null,
			source_competition_id: null,
			source_placement: null,
			source_placement_label: null,
			bespoke_reason: "Sponsored athlete",
			championship_division_id: "slvl_inv_champ_wrx",
			email: "sponsor-athlete@example.com",
			user_id: null,
			invitee_first_name: "Sponsored",
			invitee_last_name: "Athlete",
			claim_token: SEED_BESPOKE_SPONSOR_TOKEN, // deterministic seed token for the bespoke-sent row
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// ────────────────────────────────────────────────────────────────
		// Team-division invites — captains placed at the qualifier in the
		// team_rx / team_sc divisions. Claiming will land the captain on
		// the championship's Team RX / Team Scaled division registration
		// form, which collects the teammate row.
		//
		// Team RX (qualifier) ranks: Tyler 1st, Derek 2nd, Chris 3rd
		// (cutoff after Derek). Team Scaled ranks: Ashley 1st, Stephanie
		// 2nd (cutoff after Ashley). Chris's pair is intentionally not
		// invited so the roster shows the cutoff divider for Team RX.
		// ────────────────────────────────────────────────────────────────
		// 7. Pending team-rx invite for Tyler (Team Thunder, 1st).
		{
			id: "cinv_seed_team_pending_tyler",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 1,
			source_placement_label: "1st — Team Thunder · Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_team_rx",
			email: "tyler.brooks@athlete.com",
			user_id: "usr_athlete_tyler",
			invitee_first_name: "Tyler",
			invitee_last_name: "Brooks",
			claim_token: "seed-invite-tyler-pending-team-rx-phase2",
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 8. Accepted+paid team-rx invite for Derek (Team Storm, 2nd).
		{
			id: "cinv_seed_team_accepted_derek",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 2,
			source_placement_label: "2nd — Team Storm · Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_team_rx",
			email: "derek.foster@athlete.com",
			user_id: "usr_athlete_derek",
			invitee_first_name: "Derek",
			invitee_last_name: "Foster",
			claim_token: null,
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "accepted_paid",
			paid_at: now(),
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 9. Pending team-sc invite for Ashley (Team Grit, 1st).
		{
			id: "cinv_seed_team_pending_ashley",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 1,
			source_placement_label: "1st — Team Grit · Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_team_sc",
			email: "ashley.morgan@athlete.com",
			user_id: "usr_athlete_ashley",
			invitee_first_name: "Ashley",
			invitee_last_name: "Morgan",
			claim_token: "seed-invite-ashley-pending-team-sc-phase2",
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 10. Declined team-sc invite for Stephanie (Team Pulse, 2nd) —
		//     above the global_spots=1 cutoff but invited as a wave-2
		//     fallback that the captain turned down.
		{
			id: "cinv_seed_team_declined_stephanie",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "source",
			source_id: "cisrc_seed_qualifier",
			source_competition_id: "comp_inv_qualifier",
			source_placement: 2,
			source_placement_label: "2nd — Team Pulse · Regional Qualifier",
			bespoke_reason: null,
			championship_division_id: "slvl_inv_champ_team_sc",
			email: "stephanie.clark@athlete.com",
			user_id: "usr_athlete_stephanie",
			invitee_first_name: "Stephanie",
			invitee_last_name: "Clark",
			claim_token: null,
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "declined",
			paid_at: null,
			declined_at: now(),
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// 11. Bespoke team-rx invite for a sponsored team captain —
		//     mirrors row 6 but targets a team division.
		{
			id: "cinv_seed_team_bespoke_sponsor",
			championship_competition_id: "comp_inv_championship",
			round_id: "",
			origin: "bespoke",
			source_id: null,
			source_competition_id: null,
			source_placement: null,
			source_placement_label: null,
			bespoke_reason: "Sponsored team",
			championship_division_id: "slvl_inv_champ_team_rx",
			email: "sponsor-team-captain@example.com",
			user_id: null,
			invitee_first_name: "Sponsored",
			invitee_last_name: "Captain",
			claim_token: "seed-invite-sponsor-bespoke-team-rx-phase2",
			expires_at: futureDatetime(14),
			send_attempt: 1,
			status: "pending",
			paid_at: null,
			declined_at: null,
			revoked_at: null,
			revoked_by_user_id: null,
			claimed_registration_id: null,
			email_delivery_status: "sent",
			email_last_error: null,
			active_marker: "active",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "competition_invite_sources", [
		{
			id: "cisrc_seed_qualifier",
			championship_competition_id: "comp_inv_championship",
			kind: "competition",
			source_competition_id: "comp_inv_qualifier",
			source_group_id: null,
			global_spots: 3,
			division_mappings: qualifierDivisionMappings,
			sort_order: 0,
			notes: "Primary qualifier — top 3 Men's RX get invited.",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisrc_seed_boise",
			championship_competition_id: "comp_inv_championship",
			kind: "competition",
			source_competition_id: "comp_mwfc_a",
			source_group_id: null,
			global_spots: 2,
			division_mappings: boiseDivisionMappings,
			sort_order: 1,
			notes: "Second-chance slots from the Boise Throwdown (MWFC A).",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisrc_seed_mwfc_series",
			championship_competition_id: "comp_inv_championship",
			kind: "series",
			source_competition_id: null,
			source_group_id: "cgrp_seed_mwfc_series",
			global_spots: 5,
			division_mappings: mwfcDivisionMappings,
			sort_order: 2,
			notes: "Mountain West series — top 5 per division qualify.",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// ════════════════════════════════════════════════════════════════════
	// 5. Per-(source, championship division) allocation overrides (ADR-0012)
	//
	//    Authoritative allocation lives here, keyed by championship
	//    division. The qualifier and Boise sources each carry an explicit
	//    row per championship division (mirrors the per-division `spots`
	//    that previously lived only in `division_mappings` JSON). The
	//    series source stays sparse — one override on Men's RX so the
	//    details page demos a mix of "Use default" and explicit overrides
	//    without us having to click through the UI to set it up.
	//
	//    Absence of a row is the signal for "use the source default" — do
	//    NOT seed `spots: 0` to mean "no override"; that would be a hard
	//    cap of zero. Per ADR §"Allocation Resolution".
	// ════════════════════════════════════════════════════════════════════
	await batchInsert(client, "competition_invite_source_division_allocations", [
		// Qualifier source — explicit allocation for every championship division.
		{
			id: "cisda_seed_qualifier_mrx",
			source_id: "cisrc_seed_qualifier",
			championship_division_id: "slvl_inv_champ_mrx",
			spots: 3,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_qualifier_wrx",
			source_id: "cisrc_seed_qualifier",
			championship_division_id: "slvl_inv_champ_wrx",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_qualifier_sc",
			source_id: "cisrc_seed_qualifier",
			championship_division_id: "slvl_inv_champ_sc",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_qualifier_team_rx",
			source_id: "cisrc_seed_qualifier",
			championship_division_id: "slvl_inv_champ_team_rx",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_qualifier_team_sc",
			source_id: "cisrc_seed_qualifier",
			championship_division_id: "slvl_inv_champ_team_sc",
			spots: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// Boise source — explicit allocation for the three indy divisions.
		{
			id: "cisda_seed_boise_mrx",
			source_id: "cisrc_seed_boise",
			championship_division_id: "slvl_inv_champ_mrx",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_boise_wrx",
			source_id: "cisrc_seed_boise",
			championship_division_id: "slvl_inv_champ_wrx",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "cisda_seed_boise_sc",
			source_id: "cisrc_seed_boise",
			championship_division_id: "slvl_inv_champ_sc",
			spots: 2,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		// MWFC series — single override on Men's RX (4 instead of the
		// default `globalSpots = 5`). Other championship divisions
		// intentionally have no row, so the details page demos the
		// default-vs-override toggle mix.
		{
			id: "cisda_seed_mwfc_mrx",
			source_id: "cisrc_seed_mwfc_series",
			championship_division_id: "slvl_inv_champ_mrx",
			spots: 4,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
}
