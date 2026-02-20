import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding movements and tags...")

	const ts = now()

	function mov(id: string, name: string, type: string) {
		return { id, name, type, created_at: ts, updated_at: ts, update_counter: 0 }
	}

	await batchInsert(client, "movements", [
		// Weightlifting
		mov("mov_snatch", "snatch", "weightlifting"),
		mov("mov_clean", "clean", "weightlifting"),
		mov("mov_jerk", "jerk", "weightlifting"),
		mov("mov_cleanjerk", "clean and jerk", "weightlifting"),
		mov("mov_powersnatch", "power snatch", "weightlifting"),
		mov("mov_powerclean", "power clean", "weightlifting"),
		mov("mov_pushpress", "push press", "weightlifting"),
		mov("mov_press", "press", "weightlifting"),
		mov("mov_pushjerk", "push jerk", "weightlifting"),
		mov("mov_splitjerk", "split jerk", "weightlifting"),
		mov("mov_thruster", "thruster", "weightlifting"),
		mov("mov_frontsquat", "front squat", "weightlifting"),
		mov("mov_backsquat", "back squat", "weightlifting"),
		mov("mov_ohsquat", "overhead squat", "weightlifting"),
		mov("mov_deadlift", "deadlift", "weightlifting"),
		mov("mov_sdhp", "sumo deadlift high pull", "weightlifting"),
		mov("mov_benchpress", "bench press", "weightlifting"),
		mov("mov_wallball", "wall ball", "weightlifting"),
		mov("mov_kbswing", "kettlebell swing", "weightlifting"),
		mov("mov_dbsnatch", "dumbbell snatch", "weightlifting"),
		// Gymnastic
		mov("mov_pushup", "push up", "gymnastic"),
		mov("mov_hspu", "handstand push up", "gymnastic"),
		mov("mov_pullup", "pull up", "gymnastic"),
		mov("mov_ctbpullup", "chest to bar pull up", "gymnastic"),
		mov("mov_muscleup", "muscle up", "gymnastic"),
		mov("mov_ringmuscleup", "ring muscle up", "gymnastic"),
		mov("mov_toestobar", "toes to bar", "gymnastic"),
		mov("mov_knees_to_elbows", "knees to elbows", "gymnastic"),
		mov("mov_situp", "sit up", "gymnastic"),
		mov("mov_burpee", "burpee", "gymnastic"),
		mov("mov_boxjump", "box jump", "gymnastic"),
		mov("mov_airsquat", "air squat", "gymnastic"),
		mov("mov_lunge", "lunge", "gymnastic"),
		mov("mov_pistol", "pistol", "gymnastic"),
		mov("mov_ropeclimb", "rope climb", "gymnastic"),
		mov("mov_handstandwalk", "handstand walk", "gymnastic"),
		mov("mov_ringdip", "ring dip", "gymnastic"),
		mov("mov_jumpingjack", "jumping jack", "gymnastic"),
		// Monostructural
		mov("mov_run", "run", "monostructural"),
		mov("mov_row", "row", "monostructural"),
		mov("mov_bike", "bike", "monostructural"),
		mov("mov_doubleunder", "double under", "monostructural"),
		mov("mov_singleunder", "single under", "monostructural"),
		mov("mov_skierg", "ski erg", "monostructural"),
		mov("mov_assaultbike", "assault bike", "monostructural"),
	])

	// Tags
	await batchInsert(client, "spicy_tags", [
		{ id: "tag_benchmark", name: "benchmark", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_hero", name: "hero", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_girl", name: "girl", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_chipper", name: "chipper", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_amrap", name: "amrap", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_emom", name: "emom", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "tag_partner", name: "partner", created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
