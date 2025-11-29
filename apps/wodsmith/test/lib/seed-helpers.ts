import { createId } from "@paralleldrive/cuid2"
import * as schema from "@/db/schema"
import type { TestDb } from "./test-db"
import { factories } from "../factories"

/**
 * Seed a user and return the created record
 */
export async function seedUser(db: TestDb, overrides = {}) {
	const userData = factories.user(overrides)
	const [user] = await db.insert(schema.userTable).values(userData).returning()
	return user
}

/**
 * Seed a team and return the created record
 */
export async function seedTeam(db: TestDb, overrides = {}) {
	const teamData = factories.team(overrides)
	const [team] = await db.insert(schema.teamTable).values(teamData).returning()
	return team
}

/**
 * Seed a user with a team and admin membership
 */
export async function seedUserWithTeam(
	db: TestDb,
	userOverrides = {},
	teamOverrides = {},
) {
	const user = await seedUser(db, userOverrides)
	const team = await seedTeam(db, teamOverrides)

	// Create admin membership
	await db.insert(schema.teamMembershipTable).values({
		id: `membership_${createId()}`,
		teamId: team.id,
		userId: user.id,
		roleId: "admin",
		isSystemRole: true,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return { user, team }
}

/**
 * Seed a workout for a team
 */
export async function seedWorkout(
	db: TestDb,
	teamId: string,
	overrides = {},
) {
	const workoutData = factories.workout(teamId, overrides)
	const [workout] = await db
		.insert(schema.workouts)
		.values(workoutData)
		.returning()
	return workout
}

/**
 * Seed a competition for a team
 */
export async function seedCompetition(
	db: TestDb,
	organizingTeamId: string,
	overrides = {},
) {
	// First create the competition team (required for competitions)
	const competitionTeam = await seedTeam(db, {
		type: "competition_team",
		name: "Competition Team",
	})

	const competitionData = factories.competition(organizingTeamId, {
		competitionTeamId: competitionTeam.id,
		...overrides,
	})
	const [competition] = await db
		.insert(schema.competitions)
		.values(competitionData)
		.returning()

	return { competition, competitionTeam }
}

/**
 * Seed a competition division
 */
export async function seedDivision(
	db: TestDb,
	competitionId: string,
	overrides = {},
) {
	const divisionData = {
		id: `div_${createId()}`,
		competitionId,
		name: "RX",
		description: "As prescribed",
		scalingGroupId: null,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}
	const [division] = await db
		.insert(schema.competitionDivisions)
		.values(divisionData)
		.returning()
	return division
}

/**
 * Seed a complete competition setup with divisions
 */
export async function seedCompetitionWithDivisions(
	db: TestDb,
	organizingTeamId: string,
	divisionNames = ["RX", "Scaled"],
) {
	const { competition, competitionTeam } = await seedCompetition(
		db,
		organizingTeamId,
	)

	const divisions = await Promise.all(
		divisionNames.map((name, index) =>
			seedDivision(db, competition.id, { name, sortOrder: index }),
		),
	)

	return { competition, competitionTeam, divisions }
}
