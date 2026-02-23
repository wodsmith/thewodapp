import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding team memberships...")

	const ts = now()

	function mem(
		id: string,
		teamId: string,
		userId: string,
		roleId: string,
		metadata?: string | null,
	) {
		return {
			id,
			team_id: teamId,
			user_id: userId,
			role_id: roleId,
			is_system_role: 1,
			joined_at: ts,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
			is_active: 1,
			metadata: metadata ?? null,
		}
	}

	await batchInsert(client, "team_memberships", [
		// Core team memberships
		mem("tmem_admin_box1", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "usr_demo1admin", "owner"),
		mem("tmem_coach_box1", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "usr_demo2coach", "admin"),
		mem("tmem_john_box1", "team_cokkpu1klwo0ulfhl1iwzpvnbox1", "usr_demo3member", "member"),
		mem("tmem_jane_homegym", "team_homeymgym", "usr_demo4member", "owner"),
		mem("tmem_admin_personal", "team_personaladmin", "usr_demo1admin", "owner"),
		mem("tmem_coach_personal", "team_personalcoach", "usr_demo2coach", "owner"),
		mem("tmem_john_personal", "team_personaljohn", "usr_demo3member", "owner"),
		mem("tmem_jane_personal", "team_personaljane", "usr_demo4member", "owner"),
		// CrossFit team
		mem("tmem_crossfit_owner", "team_cokkpu1klwo0ulfhl1iwzpvn", "usr_crossfit001", "owner"),
		// Winter Throwdown admin
		mem("tmem_admin_winter_throwdown", "team_winter_throwdown_2025", "usr_demo1admin", "admin"),
		// Winter Throwdown athletes
		mem("tmem_mike_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_mike", "member"),
		mem("tmem_sarah_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_sarah", "member"),
		mem("tmem_chris_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_chris", "member"),
		mem("tmem_emma_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_emma", "member"),
		mem("tmem_john_winter_throwdown", "team_winter_throwdown_2025", "usr_demo3member", "member"),
		mem("tmem_alex_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_alex", "member"),
		mem("tmem_ryan_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_ryan", "member"),
		mem("tmem_marcus_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_marcus", "member"),
		mem("tmem_tyler_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_tyler", "member"),
		mem("tmem_jordan_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_jordan", "member"),
		mem("tmem_nathan_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_nathan", "member"),
		mem("tmem_derek_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_derek", "member"),
		mem("tmem_brandon_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_brandon", "member"),
		mem("tmem_megan_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_megan", "member"),
		mem("tmem_ashley_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_ashley", "member"),
		mem("tmem_brittany_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_brittany", "member"),
		mem("tmem_stephanie_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_stephanie", "member"),
		mem("tmem_lauren_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_lauren", "member"),
		mem("tmem_nicole_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_nicole", "member"),
		mem("tmem_amanda_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_amanda", "member"),
		mem("tmem_kaitlyn_winter_throwdown", "team_winter_throwdown_2025", "usr_athlete_kaitlyn", "member"),
		// Volunteers
		mem("tmem_volunteer_dave", "team_winter_throwdown_2025", "usr_volunteer_dave", "volunteer", '{"volunteerRoleTypes":["judge","head_judge"],"credentials":"L1 Judge Certified","shirtSize":"L","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_lisa", "team_winter_throwdown_2025", "usr_volunteer_lisa", "volunteer", '{"volunteerRoleTypes":["judge","scorekeeper"],"credentials":"CrossFit L2","shirtSize":"S","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_tom", "team_winter_throwdown_2025", "usr_volunteer_tom", "volunteer", '{"volunteerRoleTypes":["judge","equipment"],"shirtSize":"XL","availability":"morning","availabilityNotes":"Available 6am-12pm only","status":"approved","inviteSource":"application"}'),
		mem("tmem_volunteer_rachel", "team_winter_throwdown_2025", "usr_volunteer_rachel", "volunteer", '{"volunteerRoleTypes":["judge","check_in","medical"],"credentials":"EMT Certified","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_james", "team_winter_throwdown_2025", "usr_volunteer_james", "volunteer", '{"volunteerRoleTypes":["judge","floor_manager"],"credentials":"5 years judging experience","shirtSize":"L","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_emily", "team_winter_throwdown_2025", "usr_volunteer_emily", "volunteer", '{"volunteerRoleTypes":["judge","media"],"shirtSize":"S","availability":"afternoon","availabilityNotes":"Available after 12pm","status":"approved","inviteSource":"application"}'),
		mem("tmem_volunteer_kevin", "team_winter_throwdown_2025", "usr_volunteer_kevin", "volunteer", '{"volunteerRoleTypes":["judge","scorekeeper"],"credentials":"L1 Trainer","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_maria", "team_winter_throwdown_2025", "usr_volunteer_maria", "volunteer", '{"volunteerRoleTypes":["judge","emcee"],"credentials":"Former competitor","shirtSize":"S","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		mem("tmem_volunteer_brian", "team_winter_throwdown_2025", "usr_volunteer_brian", "volunteer", '{"volunteerRoleTypes":["judge","equipment","staff"],"shirtSize":"XL","availability":"morning","status":"approved","inviteSource":"application"}'),
		mem("tmem_volunteer_sandra", "team_winter_throwdown_2025", "usr_volunteer_sandra", "volunteer", '{"volunteerRoleTypes":["judge","general"],"credentials":"L1 Trainer","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}'),
		// Online competition memberships
		mem("tmem_john_online", "team_online_qualifier_2026", "usr_demo3member", "member"),
		mem("tmem_jane_online", "team_online_qualifier_2026", "usr_demo4member", "member"),
		mem("tmem_mike_online", "team_online_qualifier_2026", "usr_athlete_mike", "member"),
		mem("tmem_sarah_online", "team_online_qualifier_2026", "usr_athlete_sarah", "member"),
		mem("tmem_alex_online", "team_online_qualifier_2026", "usr_athlete_alex", "member"),
	])
}
