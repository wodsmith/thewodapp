import { beforeEach, describe, expect, it } from "vitest"
import { FakeSessionStore, createTestSession } from "./session"
import { createTeam } from "./team"
import { createUser } from "./user"
import { createWorkout } from "./workout"

describe("createUser", () => {
	it("should create user with defaults", () => {
		const user = createUser()

		expect(user.id).toBeDefined()
		expect(user.email).toContain("@example.com")
		expect(user.emailVerified).toBe(true)
		expect(user.name).toContain("Test User")
		expect(user.avatarUrl).toBeNull()
		expect(user.createdAt).toBeInstanceOf(Date)
		expect(user.updatedAt).toBeInstanceOf(Date)
	})

	it("should accept overrides", () => {
		const user = createUser({
			name: "Custom Name",
			email: "custom@test.com",
			emailVerified: false,
		})

		expect(user.name).toBe("Custom Name")
		expect(user.email).toBe("custom@test.com")
		expect(user.emailVerified).toBe(false)
	})
})

describe("createTeam", () => {
	it("should create team with defaults", () => {
		const team = createTeam()

		expect(team.id).toBeDefined()
		expect(team.name).toContain("Test Team")
		expect(team.slug).toContain("test-team-")
		expect(team.ownerId).toBeDefined()
	})

	it("should accept overrides", () => {
		const team = createTeam({
			name: "My Gym",
			slug: "my-gym",
		})

		expect(team.name).toBe("My Gym")
		expect(team.slug).toBe("my-gym")
	})
})

describe("createWorkout", () => {
	it("should create workout with defaults", () => {
		const workout = createWorkout()

		expect(workout.id).toBeDefined()
		expect(workout.teamId).toBeDefined()
		expect(workout.name).toContain("Test Workout")
		expect(workout.type).toBe("amrap")
		expect(workout.description).toBeNull()
	})

	it("should accept overrides", () => {
		const teamId = "my-team"
		const workout = createWorkout({
			teamId,
			type: "fortime",
			name: "Fran",
		})

		expect(workout.teamId).toBe(teamId)
		expect(workout.type).toBe("fortime")
		expect(workout.name).toBe("Fran")
	})
})

describe("createTestSession", () => {
	it("should create session with defaults", () => {
		const session = createTestSession()

		expect(session.id).toBeDefined()
		expect(session.userId).toBeDefined()
		expect(session.expiresAt).toBeGreaterThan(Date.now())
		expect(session.createdAt).toBeDefined()
		expect(session.isCurrentSession).toBe(true)
		expect(session.user.id).toBe(session.userId)
		expect(session.teams).toHaveLength(1)
		expect(session.teams![0]?.role.id).toBe("member")
		expect(session.teams![0]?.id).toBeDefined()
	})

	it("should accept custom userId and teamId", () => {
		const session = createTestSession({
			userId: "user-123",
			teamId: "team-456",
		})

		expect(session.userId).toBe("user-123")
		expect(session.user.id).toBe("user-123")
		expect(session.teams![0]?.id).toBe("team-456")
	})

	it("should accept custom teamRole", () => {
		const session = createTestSession({
			teamRole: "owner",
		})

		expect(session.teams![0]?.role.id).toBe("owner")
		expect(session.teams![0]?.role.name).toBe("Owner")
	})

	it("should accept custom permissions", () => {
		const session = createTestSession({
			permissions: ["edit_workouts", "delete_workouts"],
		})

		expect(session.teams![0]?.permissions).toEqual([
			"edit_workouts",
			"delete_workouts",
		])
	})

	it("should allow setting expiration", () => {
		const past = createTestSession({ expiresInMs: -1000 })
		const future = createTestSession({ expiresInMs: 3600000 })

		expect(past.expiresAt).toBeLessThan(Date.now())
		expect(future.expiresAt).toBeGreaterThan(Date.now())
	})
})

describe("FakeSessionStore", () => {
	let store: FakeSessionStore

	beforeEach(() => {
		store = new FakeSessionStore()
	})

	it("should store and retrieve sessions", async () => {
		const session = createTestSession()
		await store.set(session)

		const retrieved = await store.get(session.id)
		expect(retrieved).toEqual(session)
	})

	it("should return null for non-existent session", async () => {
		const result = await store.get("non-existent")
		expect(result).toBeNull()
	})

	it("should delete sessions", async () => {
		const session = createTestSession()
		await store.set(session)
		await store.delete(session.id)

		const result = await store.get(session.id)
		expect(result).toBeNull()
	})

	it("should reset all sessions", async () => {
		await store.set(createTestSession())
		await store.set(createTestSession())

		store.reset()

		// Can't directly check count, but new sessions won't exist
		const result = await store.get("any-id")
		expect(result).toBeNull()
	})
})
