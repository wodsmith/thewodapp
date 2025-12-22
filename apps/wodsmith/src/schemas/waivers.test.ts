import { describe, expect, test } from "vitest"
import {
	createWaiverSchema,
	deleteWaiverSchema,
	getWaiverSignaturesForRegistrationSchema,
	reorderWaiversSchema,
	signWaiverSchema,
	updateWaiverSchema,
} from "./waivers"

describe("createWaiverSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid waiver data", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Liability Waiver",
				content: "I agree to the terms and conditions...",
				required: true,
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toEqual(input)
			}
		})

		test("defaults required to true when omitted", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Liability Waiver",
				content: "I agree to the terms...",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.required).toBe(true)
			}
		})

		test("accepts max length title (255 chars)", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "a".repeat(255),
				content: "content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts max length content (50000 chars)", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Title",
				content: "a".repeat(50000),
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects missing competitionId", () => {
			const input = {
				teamId: "team_456def",
				title: "Title",
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects competitionId without comp_ prefix", () => {
			const input = {
				competitionId: "invalid_123",
				teamId: "team_456def",
				title: "Title",
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain(
					"Invalid competition ID",
				)
			}
		})

		test("rejects missing teamId", () => {
			const input = {
				competitionId: "comp_123abc",
				title: "Title",
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects teamId without team_ prefix", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "invalid_456",
				title: "Title",
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Invalid team ID")
			}
		})

		test("rejects empty title", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "",
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Title is required")
			}
		})

		test("rejects title exceeding 255 chars", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "a".repeat(256),
				content: "Content",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Title is too long")
			}
		})

		test("rejects empty content", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Title",
				content: "",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Content is required")
			}
		})

		test("rejects content exceeding 50000 chars", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Title",
				content: "a".repeat(50001),
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Content is too long")
			}
		})

		test("rejects invalid required type", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Title",
				content: "Content",
				required: "yes",
			}
			const result = createWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})
})

describe("updateWaiverSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid update data with all fields", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Updated Title",
				content: "Updated content",
				required: false,
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts update with only required fields", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts update with partial optional fields", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "Updated Title",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects missing waiverId", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects waiverId without waiv_ prefix", () => {
			const input = {
				waiverId: "invalid_789",
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Invalid waiver ID")
			}
		})

		test("rejects empty title when provided", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Title is required")
			}
		})

		test("rejects title exceeding 255 chars", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
				title: "a".repeat(256),
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Title is too long")
			}
		})

		test("rejects empty content when provided", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
				content: "",
			}
			const result = updateWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Content is required")
			}
		})
	})
})

describe("deleteWaiverSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid delete data", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = deleteWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects missing waiverId", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = deleteWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects waiverId without waiv_ prefix", () => {
			const input = {
				waiverId: "invalid_789",
				competitionId: "comp_123abc",
				teamId: "team_456def",
			}
			const result = deleteWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Invalid waiver ID")
			}
		})

		test("rejects missing competitionId", () => {
			const input = {
				waiverId: "waiv_789ghi",
				teamId: "team_456def",
			}
			const result = deleteWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects missing teamId", () => {
			const input = {
				waiverId: "waiv_789ghi",
				competitionId: "comp_123abc",
			}
			const result = deleteWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})
})

describe("reorderWaiversSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid reorder data", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [
					{ id: "waiv_001", position: 0 },
					{ id: "waiv_002", position: 1 },
					{ id: "waiv_003", position: 2 },
				],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts single waiver", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [{ id: "waiv_001", position: 0 }],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects empty waivers array", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain(
					"At least one waiver is required",
				)
			}
		})

		test("rejects waiver id without waiv_ prefix", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [{ id: "invalid_001", position: 0 }],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Invalid waiver ID")
			}
		})

		test("rejects negative position", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [{ id: "waiv_001", position: -1 }],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects non-integer position", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [{ id: "waiv_001", position: 1.5 }],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects missing position", () => {
			const input = {
				competitionId: "comp_123abc",
				teamId: "team_456def",
				waivers: [{ id: "waiv_001" }],
			}
			const result = reorderWaiversSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})
})

describe("signWaiverSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid signature with all fields", () => {
			const input = {
				waiverId: "waiv_789ghi",
				registrationId: "creg_abc123",
				ipAddress: "192.168.1.1",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts signature without optional fields", () => {
			const input = {
				waiverId: "waiv_789ghi",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts signature with only registrationId", () => {
			const input = {
				waiverId: "waiv_789ghi",
				registrationId: "creg_abc123",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		test("accepts IPv6 address", () => {
			const input = {
				waiverId: "waiv_789ghi",
				ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects missing waiverId", () => {
			const input = {
				registrationId: "creg_abc123",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects waiverId without waiv_ prefix", () => {
			const input = {
				waiverId: "invalid_789",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain("Invalid waiver ID")
			}
		})

		test("rejects registrationId without creg_ prefix", () => {
			const input = {
				waiverId: "waiv_789ghi",
				registrationId: "invalid_abc123",
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain(
					"Invalid registration ID",
				)
			}
		})

		test("rejects ipAddress exceeding 45 chars", () => {
			const input = {
				waiverId: "waiv_789ghi",
				ipAddress: "a".repeat(46),
			}
			const result = signWaiverSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})
})

describe("getWaiverSignaturesForRegistrationSchema", () => {
	describe("valid inputs", () => {
		test("accepts valid registration ID", () => {
			const input = {
				registrationId: "creg_abc123",
			}
			const result = getWaiverSignaturesForRegistrationSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})

	describe("invalid inputs", () => {
		test("rejects missing registrationId", () => {
			const input = {}
			const result = getWaiverSignaturesForRegistrationSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		test("rejects registrationId without creg_ prefix", () => {
			const input = {
				registrationId: "invalid_abc123",
			}
			const result = getWaiverSignaturesForRegistrationSchema.safeParse(input)
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toContain(
					"Invalid registration ID",
				)
			}
		})

		test("rejects empty registrationId", () => {
			const input = {
				registrationId: "",
			}
			const result = getWaiverSignaturesForRegistrationSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})
})
