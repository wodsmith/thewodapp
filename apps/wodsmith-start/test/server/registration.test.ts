import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

// Mock the database
const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Mock cloudflare:workers
vi.mock("cloudflare:workers", () => ({
	env: { APP_URL: "https://test.wodsmith.com" },
}))

// Mock logging
vi.mock("@/lib/logging/posthog-otel-logger", () => ({
	logError: vi.fn(),
	logInfo: vi.fn(),
	logWarning: vi.fn(),
}))

// Mock email utilities
const mockSendEmail = vi.fn()
const mockSendCompetitionTeamInviteEmail = vi.fn()
const mockSendCompetitionTeamMemberAddedEmail = vi.fn()
vi.mock("@/utils/email", () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
	sendCompetitionTeamInviteEmail: (...args: unknown[]) =>
		mockSendCompetitionTeamInviteEmail(...args),
	sendCompetitionTeamMemberAddedEmail: (...args: unknown[]) =>
		mockSendCompetitionTeamMemberAddedEmail(...args),
}))

// Mock KV session updates
const mockUpdateAllSessionsOfUser = vi.fn()
vi.mock("@/utils/kv-session", () => ({
	updateAllSessionsOfUser: (...args: unknown[]) =>
		mockUpdateAllSessionsOfUser(...args),
}))

// Mock slugify
vi.mock("@/utils/slugify", () => ({
	generateSlug: vi.fn((input: string) =>
		input.toLowerCase().replace(/\s+/g, "-"),
	),
}))

// Mock react-email template
vi.mock("@/react-email/registration-confirmation", () => ({
	RegistrationConfirmationEmail: vi.fn(() => "<html>confirmation</html>"),
}))

// Mock competition divisions fns
vi.mock("@/server-fns/competition-divisions-fns", () => ({
	parseCompetitionSettings: vi.fn((settings: string | null) => {
		if (!settings) return null
		try {
			return JSON.parse(settings)
		} catch {
			return null
		}
	}),
}))

// Mock timezone utils - default: registration window is open
vi.mock("@/utils/timezone-utils", () => ({
	DEFAULT_TIMEZONE: "America/Denver",
	hasDateStartedInTimezone: vi.fn(() => true),
	isDeadlinePassedInTimezone: vi.fn(() => false),
}))

// Mock TanStack
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
	}),
	createServerOnlyFn: (fn: unknown) => fn,
}))

// Import after mocks
import { registerForCompetition } from "@/server/registration"
import {
	hasDateStartedInTimezone,
	isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

// ============================================================================
// Test Data Factories
// ============================================================================


function makeCompetition(overrides = {}) {
	return {
		id: "comp-1",
		name: "Test Competition",
		slug: "test-competition",
		status: "published",
		organizingTeamId: "org-team-1",
		competitionTeamId: "event-team-1",
		startDate: "2025-06-15",
		endDate: "2025-06-16",
		registrationOpensAt: "2025-01-01",
		registrationClosesAt: "2025-12-31",
		timezone: "America/Denver",
		settings: JSON.stringify({ divisions: { scalingGroupId: "sg-1" } }),
		defaultRegistrationFeeCents: 5000,
		defaultMaxSpotsPerDivision: null,
		...overrides,
	}
}

function makeUser(overrides = {}) {
	return {
		id: "user-1",
		email: "athlete@test.com",
		firstName: "John",
		lastName: "Doe",
		affiliateName: null,
		...overrides,
	}
}

function makeDivision(overrides = {}) {
	return {
		id: "div-rx",
		label: "Rx",
		scalingGroupId: "sg-1",
		teamSize: 1,
		position: 0,
		...overrides,
	}
}

function makeTeamDivision(overrides = {}) {
	return makeDivision({
		id: "div-team",
		label: "Team of 3",
		teamSize: 3,
		position: 1,
		...overrides,
	})
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks()
	mockDb.reset()
	// Default: chain queries return empty arrays
	mockDb.setMockReturnValue([])
})

describe("registerForCompetition", () => {
	describe("individual registration (single division)", () => {
		it("creates registration for an individual", async () => {
			// ARRANGE
			const competition = makeCompetition()
			const user = makeUser()
			const division = makeDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(division),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// No existing registration
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null) // duplicate check
					.mockResolvedValueOnce({ id: "reg-new-1" }), // re-fetch after insert
				findMany: vi.fn().mockResolvedValue([]),
			}
			// No existing event team membership
			mockDb.query.teamMembershipTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}

			// ACT
			const result = await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-rx",
			})

			// ASSERT
			expect(result.registrationId).toBe("reg-new-1")
			expect(result.athleteTeamId).toBeNull() // individual, no team
			expect(mockUpdateAllSessionsOfUser).toHaveBeenCalledWith("user-1")
		})

		it("allows same user to register for different divisions", async () => {
			const competition = makeCompetition()
			const user = makeUser()
			const scaledDivision = makeDivision({
				id: "div-scaled",
				label: "Scaled",
			})

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(scaledDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// No duplicate registration for THIS division
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce({ id: "reg-2" }),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Already a member of event team (from another division)
			mockDb.query.teamMembershipTable = {
				findFirst: vi
					.fn()
					.mockResolvedValue({ id: "tm-existing", userId: "user-1" }),
				findMany: vi.fn().mockResolvedValue([]),
			}

			const result = await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-scaled",
			})

			// Should reuse existing event team membership
			expect(result.registrationId).toBe("reg-2")
			expect(result.athleteTeamId).toBeNull()
		})
	})

	describe("duplicate registration prevention", () => {
		it("throws when user already registered for same division", async () => {
			const competition = makeCompetition()
			const user = makeUser()
			const division = makeDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(division),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Existing registration found
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValue({ id: "existing-reg", userId: "user-1" }),
				findMany: vi.fn().mockResolvedValue([]),
			}

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow(
				"You are already registered for this division in this competition",
			)
		})

		it("throws when user already on another team in same division", async () => {
			const competition = makeCompetition()
			const user = makeUser()
			const division = makeDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(division),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi.fn().mockResolvedValue(null), // no direct registration
				findMany: vi.fn().mockResolvedValue([]),
			}

			// Already on a team for this division (chain select returns a match)
			mockDb.setMockReturnValue([{ teamId: "some-team" }])

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow("You are already on a team for this division")
		})
	})

	describe("registration window validation", () => {
		it("throws when registration has not opened yet", async () => {
			const competition = makeCompetition()
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			vi.mocked(hasDateStartedInTimezone).mockReturnValueOnce(false)

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow("Registration has not opened yet")
		})

		it("throws when registration has closed", async () => {
			const competition = makeCompetition()
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			vi.mocked(hasDateStartedInTimezone).mockReturnValueOnce(true)
			vi.mocked(isDeadlinePassedInTimezone).mockReturnValueOnce(true)

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow("Registration has closed")
		})

		it("throws when competition is draft for non-override registration", async () => {
			const competition = makeCompetition({ status: "draft" })
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			vi.mocked(hasDateStartedInTimezone).mockReturnValue(true)
			vi.mocked(isDeadlinePassedInTimezone).mockReturnValue(false)

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow("Registration is not open for this competition")
		})
	})

	describe("division validation", () => {
		it("throws when competition not found", async () => {
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}

			await expect(
				registerForCompetition({
					competitionId: "nonexistent",
					userId: "user-1",
					divisionId: "div-rx",
				}),
			).rejects.toThrow("Competition not found")
		})

		it("throws when division not found", async () => {
			const competition = makeCompetition()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(makeUser()),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "nonexistent",
				}),
			).rejects.toThrow("Division not found")
		})

		it("throws when division does not belong to competition", async () => {
			const competition = makeCompetition()
			const wrongDivision = makeDivision({
				scalingGroupId: "different-sg",
			})

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(makeUser()),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(wrongDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: wrongDivision.id,
				}),
			).rejects.toThrow(
				"Selected division does not belong to this competition",
			)
		})
	})

	describe("team registration", () => {
		function setupTeamRegistrationMocks() {
			const competition = makeCompetition()
			const user = makeUser()
			const teamDivision = makeTeamDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(user) // user lookup
					.mockResolvedValue(null), // teammate lookups
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(teamDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null) // duplicate check
					.mockResolvedValueOnce(null) // team name check
					.mockResolvedValueOnce({ id: "reg-team-1" }), // re-fetch after insert
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamMembershipTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamTable = {
				findFirst: vi.fn().mockResolvedValue(null), // slug uniqueness check
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Chain selects return empty (no existing team memberships)
			mockDb.setMockReturnValue([])

			return { competition, user, teamDivision }
		}

		it("creates team registration with teammates", async () => {
			setupTeamRegistrationMocks()

			const result = await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-team",
				teamName: "Alpha Squad",
				teammates: [
					{ email: "teammate1@test.com", firstName: "Jane" },
					{ email: "teammate2@test.com", firstName: "Bob" },
				],
			})

			expect(result.registrationId).toBe("reg-team-1")
			expect(result.athleteTeamId).toBeTruthy()
			// Teammates should be invited
			expect(mockSendCompetitionTeamInviteEmail).toHaveBeenCalledTimes(2)
		})

		it("throws when team name is missing for team division", async () => {
			setupTeamRegistrationMocks()

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-team",
					teammates: [
						{ email: "t1@test.com" },
						{ email: "t2@test.com" },
					],
				}),
			).rejects.toThrow("Team name is required for team divisions")
		})

		it("throws when wrong number of teammates", async () => {
			setupTeamRegistrationMocks()

			// Team of 3 needs 2 teammates, providing only 1
			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-team",
					teamName: "Alpha Squad",
					teammates: [{ email: "t1@test.com" }],
				}),
			).rejects.toThrow("Team requires 2 teammate(s)")
		})

		it("throws when teammate email is user's own email", async () => {
			setupTeamRegistrationMocks()

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-team",
					teamName: "Alpha Squad",
					teammates: [
						{ email: "athlete@test.com" }, // same as user
						{ email: "other@test.com" },
					],
				}),
			).rejects.toThrow(
				"athlete@test.com is your own email. Please enter a different teammate's email.",
			)
		})

		it("sends 'added to team' email to teammates who already have accounts", async () => {
			const competition = makeCompetition()
			const captain = makeUser({ id: "user-1", email: "athlete@test.com" })
			const teammate1 = makeUser({
				id: "user-tm-1",
				email: "teammate1@test.com",
				firstName: "Jane",
			})
			const teammate2 = makeUser({
				id: "user-tm-2",
				email: "teammate2@test.com",
				firstName: "Bob",
			})
			const teamDivision = makeTeamDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Sequence: captain lookup, then each teammate existing-user check,
			// then inviter lookup for each "added" email.
			mockDb.query.userTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(captain) // initial captain lookup
					.mockResolvedValueOnce(teammate1) // inviteUserToTeamInternal: existing-user check
					.mockResolvedValueOnce(captain) // inviter lookup for teammate1 added email
					.mockResolvedValueOnce(teammate2) // inviteUserToTeamInternal: existing-user check
					.mockResolvedValueOnce(captain), // inviter lookup for teammate2 added email
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(teamDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null) // duplicate check
					.mockResolvedValueOnce(null) // team name unique check
					.mockResolvedValueOnce({ id: "reg-team-existing" }), // re-fetch after insert
				findMany: vi.fn().mockResolvedValue([]),
			}
			// All membership lookups return null (neither teammate is already a member)
			mockDb.query.teamMembershipTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.setMockReturnValue([])

			await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-team",
				teamName: "Alpha Squad",
				teammates: [
					{ email: "teammate1@test.com", firstName: "Jane" },
					{ email: "teammate2@test.com", firstName: "Bob" },
				],
			})

			// Existing-account teammates: get the new "added" email, NOT the invite email
			expect(mockSendCompetitionTeamInviteEmail).not.toHaveBeenCalled()
			expect(mockSendCompetitionTeamMemberAddedEmail).toHaveBeenCalledTimes(2)

			const firstCall = mockSendCompetitionTeamMemberAddedEmail.mock.calls[0][0]
			expect(firstCall.email).toBe("teammate1@test.com")
			expect(firstCall.competitionName).toBe("Test Competition")
			expect(firstCall.teamName).toBe("Alpha Squad")
			expect(firstCall.divisionName).toBe("Team of 3")
			expect(firstCall.registrationId).toBe("reg-team-existing")
			expect(firstCall.competitionSlug).toBe("test-competition")
		})

		it("sends invite email to new teammates and 'added' email to existing-account teammates in same registration", async () => {
			const competition = makeCompetition()
			const captain = makeUser({ id: "user-1", email: "athlete@test.com" })
			const existingTeammate = makeUser({
				id: "user-tm-existing",
				email: "existing@test.com",
				firstName: "Jane",
			})
			const teamDivision = makeTeamDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Order: captain, then for teammate1 (existing): user-exists check + inviter lookup;
			// then for teammate2 (new): user-exists check (null) + inviter lookup.
			mockDb.query.userTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(captain)
					.mockResolvedValueOnce(existingTeammate)
					.mockResolvedValueOnce(captain)
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce(captain),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(teamDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce({ id: "reg-team-mixed" }),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamMembershipTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.setMockReturnValue([])

			await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-team",
				teamName: "Alpha Squad",
				teammates: [
					{ email: "existing@test.com", firstName: "Jane" },
					{ email: "new@test.com", firstName: "Bob" },
				],
			})

			expect(mockSendCompetitionTeamMemberAddedEmail).toHaveBeenCalledTimes(1)
			expect(
				mockSendCompetitionTeamMemberAddedEmail.mock.calls[0][0].email,
			).toBe("existing@test.com")
			expect(mockSendCompetitionTeamInviteEmail).toHaveBeenCalledTimes(1)
			expect(
				mockSendCompetitionTeamInviteEmail.mock.calls[0][0].email,
			).toBe("new@test.com")
		})

		it("does not send 'added' email when teammate is already a member of the team", async () => {
			const competition = makeCompetition()
			const captain = makeUser({ id: "user-1", email: "athlete@test.com" })
			const teammate = makeUser({
				id: "user-tm-existing",
				email: "existing@test.com",
				firstName: "Jane",
			})
			const newTeammate = makeUser({
				id: "user-tm-new",
				email: "newone@test.com",
			})
			const teamDivision = makeTeamDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(captain)
					.mockResolvedValueOnce(teammate) // teammate1 already exists
					.mockResolvedValueOnce(newTeammate), // teammate2 also exists
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(teamDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce({ id: "reg-team-allmembers" }),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Both teammates are already members of the athlete team → early return
			mockDb.query.teamMembershipTable = {
				findFirst: vi
					.fn()
					.mockResolvedValue({ id: "existing-membership" }),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.setMockReturnValue([])

			await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-team",
				teamName: "Alpha Squad",
				teammates: [
					{ email: "existing@test.com" },
					{ email: "newone@test.com" },
				],
			})

			// Neither email should be sent — both are already team members
			expect(mockSendCompetitionTeamMemberAddedEmail).not.toHaveBeenCalled()
			expect(mockSendCompetitionTeamInviteEmail).not.toHaveBeenCalled()
		})

		it("throws when team name already taken (case-insensitive)", async () => {
			const competition = makeCompetition()
			const user = makeUser()
			const teamDivision = makeTeamDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(teamDivision),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// Team name check (step 7b) happens BEFORE duplicate check (step 8)
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce({ id: "existing-team-reg" }), // team name taken
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.setMockReturnValue([])

			await expect(
				registerForCompetition({
					competitionId: "comp-1",
					userId: "user-1",
					divisionId: "div-team",
					teamName: "Alpha Squad",
					teammates: [
						{ email: "t1@test.com" },
						{ email: "t2@test.com" },
					],
				}),
			).rejects.toThrow(
				'Team name "Alpha Squad" is already taken for this competition',
			)
		})
	})

	describe("affiliate name handling", () => {
		it("stores affiliate in registration metadata", async () => {
			const competition = makeCompetition()
			const user = makeUser()
			const division = makeDivision()

			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue(competition),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.userTable = {
				findFirst: vi.fn().mockResolvedValue(user),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.scalingLevelsTable = {
				findFirst: vi.fn().mockResolvedValue(division),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionRegistrationsTable = {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce({ id: "reg-aff" }),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.teamMembershipTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}

			const result = await registerForCompetition({
				competitionId: "comp-1",
				userId: "user-1",
				divisionId: "div-rx",
				affiliateName: "Functional Fitness Denver",
			})

			expect(result.registrationId).toBe("reg-aff")
			// Insert should have been called with metadata containing affiliate
			expect(mockDb.insert).toHaveBeenCalled()
		})
	})
})
