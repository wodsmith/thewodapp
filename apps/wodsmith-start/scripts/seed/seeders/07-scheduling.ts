import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding scheduling (skills, locations, classes, coaches)...")

	const ts = now()

	// Skills
	await batchInsert(client, "skills", [
		// CrossFit Box One skills
		{ id: "skill_cf1_l1", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "CrossFit Level 1 Trainer", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_l2", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "CrossFit Level 2 Trainer", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_l3", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "CrossFit Level 3 Trainer", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_oly", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Olympic Weightlifting", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_gym", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Gymnastics", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_power", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Powerlifting", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_endurance", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Endurance", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_nutrition", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Nutrition Coaching", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_mobility", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Mobility & Recovery", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_cf1_kettlebell", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Kettlebell Sport", created_at: ts, updated_at: ts, update_counter: 0 },
		// Home Gym Heroes skills
		{ id: "skill_hgh_bodyweight", team_id: "team_homeymgym", name: "Bodyweight Training", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_hgh_calisthenics", team_id: "team_homeymgym", name: "Calisthenics", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_hgh_yoga", team_id: "team_homeymgym", name: "Yoga", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_hgh_hiit", team_id: "team_homeymgym", name: "HIIT Training", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "skill_hgh_functional", team_id: "team_homeymgym", name: "Functional Movement", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Locations
	await batchInsert(client, "locations", [
		{ id: "loc_cf1_main", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Main Floor", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "loc_cf1_outdoor", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Outdoor Area", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "loc_cf1_strength", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Strength Room", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "loc_hgh_online", team_id: "team_homeymgym", name: "Online Platform", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "loc_hgh_park", team_id: "team_homeymgym", name: "Local Park", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Class catalogs
	await batchInsert(client, "class_catalogs", [
		{ id: "class_cf1_wod", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "CrossFit WOD", description: "Daily CrossFit workout of the day with scaling options for all levels", duration_minutes: 60, max_participants: 12, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_cf1_strength", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Strength & Conditioning", description: "Focused strength training with barbell movements and accessory work", duration_minutes: 75, max_participants: 8, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_cf1_oly", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Olympic Lifting", description: "Technical instruction and practice of snatch and clean & jerk", duration_minutes: 90, max_participants: 6, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_cf1_beginners", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Beginners Fundamentals", description: "Introduction to CrossFit movements and methodology for new athletes", duration_minutes: 45, max_participants: 6, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_cf1_open_gym", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", name: "Open Gym", description: "Self-directed training time with coach supervision", duration_minutes: 90, max_participants: 15, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_hgh_hiit", team_id: "team_homeymgym", name: "HIIT Bodyweight", description: "High-intensity bodyweight circuits requiring no equipment", duration_minutes: 45, max_participants: 20, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_hgh_yoga", team_id: "team_homeymgym", name: "Flow Yoga", description: "Dynamic yoga flows for mobility and mindfulness", duration_minutes: 60, max_participants: 15, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "class_hgh_calisthenics", team_id: "team_homeymgym", name: "Calisthenics Progressions", description: "Progressive bodyweight skills training", duration_minutes: 75, max_participants: 10, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Coaches
	await batchInsert(client, "coaches", [
		{ id: "coach_cf1_admin", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", user_id: "usr_demo1admin", weekly_class_limit: 20, scheduling_preference: "any", is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "coach_cf1_smith", team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1", user_id: "usr_demo2coach", weekly_class_limit: 15, scheduling_preference: "morning", is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "coach_hgh_jane", team_id: "team_homeymgym", user_id: "usr_demo4member", weekly_class_limit: 12, scheduling_preference: "afternoon", is_active: 1, created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Coach to skills
	await batchInsert(client, "coach_to_skills", [
		{ coach_id: "coach_cf1_admin", skill_id: "skill_cf1_l3" },
		{ coach_id: "coach_cf1_admin", skill_id: "skill_cf1_oly" },
		{ coach_id: "coach_cf1_admin", skill_id: "skill_cf1_power" },
		{ coach_id: "coach_cf1_admin", skill_id: "skill_cf1_nutrition" },
		{ coach_id: "coach_cf1_smith", skill_id: "skill_cf1_l2" },
		{ coach_id: "coach_cf1_smith", skill_id: "skill_cf1_gym" },
		{ coach_id: "coach_cf1_smith", skill_id: "skill_cf1_mobility" },
		{ coach_id: "coach_hgh_jane", skill_id: "skill_hgh_yoga" },
		{ coach_id: "coach_hgh_jane", skill_id: "skill_hgh_hiit" },
		{ coach_id: "coach_hgh_jane", skill_id: "skill_hgh_functional" },
	])

	// Class catalog to skills
	await batchInsert(client, "class_catalog_to_skills", [
		{ class_catalog_id: "class_cf1_wod", skill_id: "skill_cf1_l1" },
		{ class_catalog_id: "class_cf1_strength", skill_id: "skill_cf1_power" },
		{ class_catalog_id: "class_cf1_strength", skill_id: "skill_cf1_l2" },
		{ class_catalog_id: "class_cf1_oly", skill_id: "skill_cf1_oly" },
		{ class_catalog_id: "class_cf1_oly", skill_id: "skill_cf1_l2" },
		{ class_catalog_id: "class_cf1_beginners", skill_id: "skill_cf1_l2" },
		{ class_catalog_id: "class_cf1_open_gym", skill_id: "skill_cf1_l1" },
		{ class_catalog_id: "class_hgh_hiit", skill_id: "skill_hgh_hiit" },
		{ class_catalog_id: "class_hgh_yoga", skill_id: "skill_hgh_yoga" },
		{ class_catalog_id: "class_hgh_calisthenics", skill_id: "skill_hgh_calisthenics" },
		{ class_catalog_id: "class_hgh_calisthenics", skill_id: "skill_hgh_bodyweight" },
	])
}
