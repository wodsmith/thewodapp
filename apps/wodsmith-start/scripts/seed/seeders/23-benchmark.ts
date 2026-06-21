import type { Connection } from "mysql2/promise"
import { buildBenchmarkSeedRows } from "../data/benchmark-training-guide"
import { batchInsert, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding benchmark battery data...")

	const rows = buildBenchmarkSeedRows(now())

	await batchInsert(client, "teams", rows.teams)
	await batchInsert(client, "team_memberships", rows.teamMemberships)
	await batchInsert(client, "scaling_groups", rows.scalingGroups)
	await batchInsert(client, "scaling_levels", rows.scalingLevels)
	await batchInsert(client, "competitions", rows.competitions)
	await batchInsert(client, "competition_divisions", rows.competitionDivisions)
	await batchInsert(client, "programming_tracks", rows.programmingTracks)
	await batchInsert(client, "workouts", rows.workouts)
	await batchInsert(client, "track_workouts", rows.trackWorkouts)
	await batchInsert(client, "benchmark_batteries", rows.benchmarkBatteries)
	await batchInsert(client, "benchmark_tests", rows.benchmarkTests)
	await batchInsert(
		client,
		"benchmark_tier_thresholds",
		rows.benchmarkTierThresholds,
	)
}
