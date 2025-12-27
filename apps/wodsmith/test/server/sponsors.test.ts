import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { createSponsor, createSponsorGroup } from "@repo/test-utils/factories"
import {
	assignWorkoutSponsor,
	createSponsor as createSponsorFn,
	createSponsorGroup as createSponsorGroupFn,
	deleteSponsor,
	deleteSponsorGroup,
	getCompetitionSponsorGroups,
	getCompetitionSponsors,
	getSponsor,
	getUserSponsors,
	getWorkoutSponsor,
	reorderSponsorGroups,
	reorderSponsors,
	updateSponsor,
	updateSponsorGroup,
} from "@/server/sponsors"
import type {
	Competition,
	ProgrammingTrack,
	Sponsor,
	SponsorGroup,
	TrackWorkout,
} from "@/db/schema"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Mock permissions
vi.mock("@/utils/team-auth", () => ({
	requireTeamPermission: vi.fn(),
}))

describe("Sponsor Server Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
	})

	describe("getSponsor", () => {
		it("returns sponsor by ID", async () => {
			const sponsor = createSponsor({ id: "sponsor-1", name: "Nike" })

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([sponsor])

			const result = await getSponsor("sponsor-1")

			expect(result).toEqual(sponsor)
			expect(mockDb.select).toHaveBeenCalled()
			expect(mockDb.from).toHaveBeenCalled()
		})

		it("returns null when sponsor not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([])

			const result = await getSponsor("nonexistent")

			expect(result).toBeNull()
		})
	})

	describe("getCompetitionSponsors", () => {
		it("returns organized sponsors with groups and ungrouped", async () => {
			const competitionId = "comp-1"

			// Create groups
			const goldGroup = createSponsorGroup({
				id: "group-gold",
				competitionId,
				name: "Gold Sponsors",
				displayOrder: 0,
			})
			const silverGroup = createSponsorGroup({
				id: "group-silver",
				competitionId,
				name: "Silver Sponsors",
				displayOrder: 1,
			})

			// Create sponsors
			const goldSponsor1 = createSponsor({
				id: "s1",
				competitionId,
				groupId: "group-gold",
				name: "Nike",
				displayOrder: 0,
			})
			const goldSponsor2 = createSponsor({
				id: "s2",
				competitionId,
				groupId: "group-gold",
				name: "Reebok",
				displayOrder: 1,
			})
			const silverSponsor = createSponsor({
				id: "s3",
				competitionId,
				groupId: "group-silver",
				name: "Rogue",
				displayOrder: 0,
			})
			const ungroupedSponsor = createSponsor({
				id: "s4",
				competitionId,
				groupId: null,
				name: "LocalGym",
				displayOrder: 0,
			})

			const orderByMock = mockDb.getChainMock().orderBy as any
			// First call: get groups
			orderByMock.mockResolvedValueOnce([goldGroup, silverGroup])
			// Second call: get sponsors
			orderByMock.mockResolvedValueOnce([
				goldSponsor1,
				goldSponsor2,
				silverSponsor,
				ungroupedSponsor,
			])

			const result = await getCompetitionSponsors(competitionId)

			expect(result.groups).toHaveLength(2)
			expect(result.groups[0].id).toBe("group-gold")
			expect(result.groups[0].sponsors).toHaveLength(2)
			expect(result.groups[0].sponsors[0].name).toBe("Nike")
			expect(result.groups[1].id).toBe("group-silver")
			expect(result.groups[1].sponsors).toHaveLength(1)
			expect(result.ungroupedSponsors).toHaveLength(1)
			expect(result.ungroupedSponsors[0].name).toBe("LocalGym")
		})

		it("returns empty arrays when no sponsors exist", async () => {
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([]) // No groups
			orderByMock.mockResolvedValueOnce([]) // No sponsors

			const result = await getCompetitionSponsors("comp-1")

			expect(result.groups).toEqual([])
			expect(result.ungroupedSponsors).toEqual([])
		})
	})

	describe("getCompetitionSponsorGroups", () => {
		it("returns ordered list of sponsor groups", async () => {
			const group1 = createSponsorGroup({
				id: "g1",
				name: "Gold",
				displayOrder: 0,
			})
			const group2 = createSponsorGroup({
				id: "g2",
				name: "Silver",
				displayOrder: 1,
			})

			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([group1, group2])

			const result = await getCompetitionSponsorGroups("comp-1")

			expect(result).toHaveLength(2)
			expect(result[0].name).toBe("Gold")
			expect(result[1].name).toBe("Silver")
		})

		it("returns empty array when no groups exist", async () => {
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([])

			const result = await getCompetitionSponsorGroups("comp-1")

			expect(result).toEqual([])
		})
	})

	describe("getUserSponsors", () => {
		it("returns ordered sponsors for user", async () => {
			const sponsor1 = createSponsor({
				id: "s1",
				userId: "user-1",
				competitionId: null,
				name: "Athlete Sponsor 1",
				displayOrder: 0,
			})
			const sponsor2 = createSponsor({
				id: "s2",
				userId: "user-1",
				competitionId: null,
				name: "Athlete Sponsor 2",
				displayOrder: 1,
			})

			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([sponsor1, sponsor2])

			const result = await getUserSponsors("user-1")

			expect(result).toHaveLength(2)
			expect(result[0].name).toBe("Athlete Sponsor 1")
			expect(result[1].name).toBe("Athlete Sponsor 2")
		})

		it("returns empty array when user has no sponsors", async () => {
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([])

			const result = await getUserSponsors("user-1")

			expect(result).toEqual([])
		})
	})

	describe("createSponsorGroup", () => {
		it("creates sponsor group with auto-order", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const created = createSponsorGroup({
				id: "new-group",
				competitionId: "comp-1",
				name: "Gold Sponsors",
				displayOrder: 0,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			// Get competition
			whereMock.mockResolvedValueOnce([competition])
			// Get existing groups (empty)
			whereMock.mockResolvedValueOnce([])
			// Return created group
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorGroupFn({
				competitionId: "comp-1",
				name: "Gold Sponsors",
			})

			expect(result).toEqual(created)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("creates sponsor group with explicit order", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const created = createSponsorGroup({
				id: "new-group",
				competitionId: "comp-1",
				name: "Silver Sponsors",
				displayOrder: 2,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorGroupFn({
				competitionId: "comp-1",
				name: "Silver Sponsors",
				displayOrder: 2,
			})

			expect(result.displayOrder).toBe(2)
		})

		it("appends to end when no order specified", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const existingGroups = [
				createSponsorGroup({ displayOrder: 0 }),
				createSponsorGroup({ displayOrder: 1 }),
			]

			const created = createSponsorGroup({
				displayOrder: 2,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce(existingGroups)
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorGroupFn({
				competitionId: "comp-1",
				name: "Bronze Sponsors",
			})

			expect(result.displayOrder).toBe(2)
		})

		it("throws when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			await expect(
				createSponsorGroupFn({
					competitionId: "nonexistent",
					name: "Test",
				}),
			).rejects.toThrow("Competition not found")
		})
	})

	describe("updateSponsorGroup", () => {
		it("updates sponsor group name", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const existing = createSponsorGroup({
				id: "group-1",
				competitionId: "comp-1",
				name: "Old Name",
				displayOrder: 0,
			})

			const updated = { ...existing, name: "New Name" }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([existing])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsorGroup({
				groupId: "group-1",
				competitionId: "comp-1",
				name: "New Name",
			})

			expect(result?.name).toBe("New Name")
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("updates display order", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const existing = createSponsorGroup({
				id: "group-1",
				competitionId: "comp-1",
				displayOrder: 0,
			})

			const updated = { ...existing, displayOrder: 5 }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([existing])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsorGroup({
				groupId: "group-1",
				competitionId: "comp-1",
				displayOrder: 5,
			})

			expect(result?.displayOrder).toBe(5)
		})

		it("returns null when group not found", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([]) // No group

			const result = await updateSponsorGroup({
				groupId: "nonexistent",
				competitionId: "comp-1",
				name: "Test",
			})

			expect(result).toBeNull()
		})

		it("throws when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			await expect(
				updateSponsorGroup({
					groupId: "group-1",
					competitionId: "nonexistent",
					name: "Test",
				}),
			).rejects.toThrow("Competition not found")
		})
	})

	describe("deleteSponsorGroup", () => {
		it("deletes sponsor group successfully", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const existing = createSponsorGroup({
				id: "group-1",
				competitionId: "comp-1",
			})

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([existing])

			const result = await deleteSponsorGroup({
				groupId: "group-1",
				competitionId: "comp-1",
			})

			expect(result.success).toBe(true)
			expect(mockDb.delete).toHaveBeenCalled()
		})

		it("returns success when group already deleted", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([]) // Group not found

			const result = await deleteSponsorGroup({
				groupId: "nonexistent",
				competitionId: "comp-1",
			})

			expect(result.success).toBe(true)
		})

		it("returns error when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			const result = await deleteSponsorGroup({
				groupId: "group-1",
				competitionId: "nonexistent",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("Competition not found")
		})
	})

	describe("reorderSponsorGroups", () => {
		it("updates display order for multiple groups", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])

			const result = await reorderSponsorGroups({
				competitionId: "comp-1",
				groupIds: ["group-3", "group-1", "group-2"],
			})

			expect(result.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalledTimes(3)
		})

		it("throws when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			await expect(
				reorderSponsorGroups({
					competitionId: "nonexistent",
					groupIds: ["g1", "g2"],
				}),
			).rejects.toThrow("Competition not found")
		})

		it("handles empty group list", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([competition])

			const result = await reorderSponsorGroups({
				competitionId: "comp-1",
				groupIds: [],
			})

			expect(result.success).toBe(true)
			expect(mockDb.update).not.toHaveBeenCalled()
		})
	})

	describe("createSponsor", () => {
		it("creates competition sponsor with auto-order", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const created = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
				name: "Nike",
				displayOrder: 0,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([]) // No existing sponsors
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorFn({
				competitionId: "comp-1",
				name: "Nike",
			})

			expect(result.name).toBe("Nike")
			expect(result.displayOrder).toBe(0)
		})

		it("creates user sponsor", async () => {
			const created = createSponsor({
				id: "sponsor-1",
				userId: "user-1",
				competitionId: null,
				name: "Athlete Sponsor",
				displayOrder: 0,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([]) // No existing sponsors
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorFn({
				userId: "user-1",
				name: "Athlete Sponsor",
			})

			expect(result.userId).toBe("user-1")
			expect(result.competitionId).toBeNull()
		})

		it("creates sponsor with group assignment", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const created = createSponsor({
				competitionId: "comp-1",
				groupId: "group-1",
				name: "Reebok",
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([])
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorFn({
				competitionId: "comp-1",
				groupId: "group-1",
				name: "Reebok",
			})

			expect(result.groupId).toBe("group-1")
		})

		it("throws when neither competitionId nor userId provided", async () => {
			await expect(
				createSponsorFn({
					name: "Test",
				}),
			).rejects.toThrow("Either competitionId or userId is required")
		})

		it("throws when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			await expect(
				createSponsorFn({
					competitionId: "nonexistent",
					name: "Test",
				}),
			).rejects.toThrow("Competition not found")
		})

		it("appends to end of existing sponsors", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const existingSponsors = [
				createSponsor({ displayOrder: 0 }),
				createSponsor({ displayOrder: 1 }),
			]

			const created = createSponsor({
				competitionId: "comp-1",
				name: "New Sponsor",
				displayOrder: 2,
			})

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce(existingSponsors)
			returningMock.mockResolvedValueOnce([created])

			const result = await createSponsorFn({
				competitionId: "comp-1",
				name: "New Sponsor",
			})

			expect(result.displayOrder).toBe(2)
		})
	})

	describe("updateSponsor", () => {
		it("updates sponsor name", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
				name: "Old Name",
			})

			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const updated = { ...existing, name: "New Name" }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([existing])
			whereMock.mockResolvedValueOnce([competition])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsor({
				sponsorId: "sponsor-1",
				name: "New Name",
			})

			expect(result?.name).toBe("New Name")
		})

		it("updates sponsor group assignment", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
				groupId: "old-group",
			})

			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const updated = { ...existing, groupId: "new-group" }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([existing])
			whereMock.mockResolvedValueOnce([competition])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsor({
				sponsorId: "sponsor-1",
				groupId: "new-group",
			})

			expect(result?.groupId).toBe("new-group")
		})

		it("removes sponsor from group", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
				groupId: "group-1",
			})

			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const updated = { ...existing, groupId: null }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([existing])
			whereMock.mockResolvedValueOnce([competition])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsor({
				sponsorId: "sponsor-1",
				groupId: null,
			})

			expect(result?.groupId).toBeNull()
		})

		it("updates logo URL", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				userId: "user-1",
				competitionId: null,
				logoUrl: null,
			})

			const updated = { ...existing, logoUrl: "https://example.com/logo.png" }

			const whereMock = mockDb.getChainMock().where as any
			const returningMock = mockDb.getChainMock().returning as any

			whereMock.mockResolvedValueOnce([existing])
			returningMock.mockResolvedValueOnce([updated])

			const result = await updateSponsor({
				sponsorId: "sponsor-1",
				logoUrl: "https://example.com/logo.png",
			})

			expect(result?.logoUrl).toBe("https://example.com/logo.png")
		})

		it("returns null when sponsor not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No sponsor

			const result = await updateSponsor({
				sponsorId: "nonexistent",
				name: "Test",
			})

			expect(result).toBeNull()
		})
	})

	describe("deleteSponsor", () => {
		it("deletes sponsor and clears workout references", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
			})

			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([existing])
			whereMock.mockResolvedValueOnce([competition])

			const result = await deleteSponsor({
				sponsorId: "sponsor-1",
			})

			expect(result.success).toBe(true)
			// Should update trackWorkouts first
			expect(mockDb.update).toHaveBeenCalled()
			// Then delete sponsor
			expect(mockDb.delete).toHaveBeenCalled()
		})

		it("returns success when sponsor already deleted", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No sponsor

			const result = await deleteSponsor({
				sponsorId: "nonexistent",
			})

			expect(result.success).toBe(true)
		})

		it("deletes user sponsor without permission check", async () => {
			const existing = createSponsor({
				id: "sponsor-1",
				userId: "user-1",
				competitionId: null,
			})

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([existing])

			const result = await deleteSponsor({
				sponsorId: "sponsor-1",
			})

			expect(result.success).toBe(true)
		})
	})

	describe("reorderSponsors", () => {
		it("reorders sponsors within competition", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([competition])

			const result = await reorderSponsors({
				competitionId: "comp-1",
				sponsorOrders: [
					{ sponsorId: "s3", groupId: "g1", displayOrder: 0 },
					{ sponsorId: "s1", groupId: "g1", displayOrder: 1 },
					{ sponsorId: "s2", groupId: null, displayOrder: 0 },
				],
			})

			expect(result.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalledTimes(3)
		})

		it("moves sponsor between groups", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([competition])

			const result = await reorderSponsors({
				competitionId: "comp-1",
				sponsorOrders: [
					{ sponsorId: "s1", groupId: "group-2", displayOrder: 0 },
				],
			})

			expect(result.success).toBe(true)
		})

		it("throws when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			await expect(
				reorderSponsors({
					competitionId: "nonexistent",
					sponsorOrders: [],
				}),
			).rejects.toThrow("Competition not found")
		})
	})

	describe("assignWorkoutSponsor", () => {
		it("assigns sponsor to track workout", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const trackWorkout = {
				id: "tw-1",
			} as TrackWorkout

			const sponsor = createSponsor({
				id: "sponsor-1",
				competitionId: "comp-1",
			})

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([trackWorkout])
			whereMock.mockResolvedValueOnce([sponsor])

			const result = await assignWorkoutSponsor({
				trackWorkoutId: "tw-1",
				competitionId: "comp-1",
				sponsorId: "sponsor-1",
			})

			expect(result.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("clears sponsor from track workout", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const trackWorkout = {
				id: "tw-1",
			} as TrackWorkout

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([trackWorkout])

			const result = await assignWorkoutSponsor({
				trackWorkoutId: "tw-1",
				competitionId: "comp-1",
				sponsorId: null,
			})

			expect(result.success).toBe(true)
		})

		it("returns error when competition not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No competition

			const result = await assignWorkoutSponsor({
				trackWorkoutId: "tw-1",
				competitionId: "nonexistent",
				sponsorId: "sponsor-1",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("Competition not found")
		})

		it("returns error when track workout not found", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([]) // No track workout

			const result = await assignWorkoutSponsor({
				trackWorkoutId: "nonexistent",
				competitionId: "comp-1",
				sponsorId: "sponsor-1",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("Track workout not found for this competition")
		})

		it("returns error when sponsor not found for competition", async () => {
			const competition = {
				id: "comp-1",
				organizingTeamId: "team-1",
			} as Competition

			const trackWorkout = {
				id: "tw-1",
			} as TrackWorkout

			const whereMock = mockDb.getChainMock().where as any

			whereMock.mockResolvedValueOnce([competition])
			whereMock.mockResolvedValueOnce([trackWorkout])
			whereMock.mockResolvedValueOnce([]) // No sponsor

			const result = await assignWorkoutSponsor({
				trackWorkoutId: "tw-1",
				competitionId: "comp-1",
				sponsorId: "wrong-sponsor",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("Sponsor not found for this competition")
		})
	})

	describe("getWorkoutSponsor", () => {
		it("returns sponsor for track workout", async () => {
			const trackWorkout = {
				sponsorId: "sponsor-1",
			}

			const sponsor = createSponsor({
				id: "sponsor-1",
				name: "Nike",
			})

			const whereMock = mockDb.getChainMock().where as any

			// First call: get track workout
			whereMock.mockResolvedValueOnce([trackWorkout])
			// Second call: get sponsor
			whereMock.mockResolvedValueOnce([sponsor])

			const result = await getWorkoutSponsor("tw-1")

			expect(result?.name).toBe("Nike")
		})

		it("returns null when track workout has no sponsor", async () => {
			const trackWorkout = {
				sponsorId: null,
			}

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([trackWorkout])

			const result = await getWorkoutSponsor("tw-1")

			expect(result).toBeNull()
		})

		it("returns null when track workout not found", async () => {
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([]) // No track workout

			const result = await getWorkoutSponsor("nonexistent")

			expect(result).toBeNull()
		})
	})
})
