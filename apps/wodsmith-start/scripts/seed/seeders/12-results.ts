import type { Client } from "@planetscale/database"
import { batchInsert, now } from "../helpers"

export async function seed(client: Client): Promise<void> {
	console.log("Seeding results, sets, and credit transactions...")

	const ts = now()

	// WOD results
	await batchInsert(client, "results", [
		{ id: "res_john_fran", user_id: "usr_demo3member", date: ts, workout_id: "wod_fran", type: "wod", wod_score: "4:23", scale: "rx", notes: "Great form on thrusters", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "res_jane_cindy", user_id: "usr_demo4member", date: ts, workout_id: "wod_cindy", type: "wod", wod_score: "15 rounds + 3 reps", scale: "rx", notes: "Consistent pace throughout", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "res_coach_helen", user_id: "usr_demo2coach", date: ts, workout_id: "wod_helen", type: "wod", wod_score: "8:45", scale: "rx", notes: "Pushed hard on the runs", created_at: ts, updated_at: ts, update_counter: 0 },
		// Strength results
		{ id: "res_john_squat", user_id: "usr_demo3member", date: ts, type: "strength", set_count: 5, notes: "Back squat work - feeling strong", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "res_jane_press", user_id: "usr_demo4member", date: ts, type: "strength", set_count: 3, notes: "Overhead press PR attempt", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Sets
	await batchInsert(client, "sets", [
		// John's back squats
		{ id: "set_john_squat_1", result_id: "res_john_squat", set_number: 1, reps: 5, weight: 185, notes: "Warmup set", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_john_squat_2", result_id: "res_john_squat", set_number: 2, reps: 5, weight: 205, notes: "Working weight", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_john_squat_3", result_id: "res_john_squat", set_number: 3, reps: 5, weight: 225, notes: "Getting heavy", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_john_squat_4", result_id: "res_john_squat", set_number: 4, reps: 3, weight: 245, notes: "Near max effort", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_john_squat_5", result_id: "res_john_squat", set_number: 5, reps: 1, weight: 255, notes: "New PR!", created_at: ts, updated_at: ts, update_counter: 0 },
		// Jane's overhead press
		{ id: "set_jane_press_1", result_id: "res_jane_press", set_number: 1, reps: 5, weight: 65, notes: "Warmup", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_jane_press_2", result_id: "res_jane_press", set_number: 2, reps: 3, weight: 85, notes: "Working up", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "set_jane_press_3", result_id: "res_jane_press", set_number: 3, reps: 1, weight: 95, notes: "PR attempt - success!", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Credit transactions
	await batchInsert(client, "credit_transactions", [
		{ id: "ctxn_admin_monthly", user_id: "usr_demo1admin", amount: 100, remaining_amount: 90, type: "MONTHLY_REFRESH", description: "Monthly admin credit refresh", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ctxn_coach_purchase", user_id: "usr_demo2coach", amount: 50, remaining_amount: 35, type: "PURCHASE", description: "Credit purchase - starter pack", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "ctxn_john_usage", user_id: "usr_demo3member", amount: -5, remaining_amount: 0, type: "USAGE", description: "Used credits for premium workout", created_at: ts, updated_at: ts, update_counter: 0 },
	])
}
