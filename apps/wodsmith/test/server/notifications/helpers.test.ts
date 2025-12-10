import { describe, expect, it } from "vitest"
import {
	formatCents,
	formatDate,
	getAthleteName,
	parsePendingTeammateCount,
	isTeamComplete,
	buildInviteLink,
	getTeammateJoinedSubject,
} from "@/server/notifications/helpers"

describe("formatCents", () => {
	it("formats whole dollar amounts", () => {
		expect(formatCents(5000)).toBe("$50.00")
		expect(formatCents(10000)).toBe("$100.00")
		expect(formatCents(100)).toBe("$1.00")
	})

	it("formats amounts with cents", () => {
		expect(formatCents(5325)).toBe("$53.25")
		expect(formatCents(1099)).toBe("$10.99")
		expect(formatCents(50)).toBe("$0.50")
	})

	it("formats zero", () => {
		expect(formatCents(0)).toBe("$0.00")
	})

	it("formats large amounts", () => {
		expect(formatCents(100000)).toBe("$1000.00")
		expect(formatCents(999999)).toBe("$9999.99")
	})

	it("handles single cent", () => {
		expect(formatCents(1)).toBe("$0.01")
	})
})

describe("formatDate", () => {
	it("formats date with full weekday, month, day, year using UTC", () => {
		// UTC midnight - March 15, 2025 is a Saturday
		const date = new Date(Date.UTC(2025, 2, 15))
		const result = formatDate(date)

		expect(result).toBe("Saturday, March 15, 2025")
	})

	it("formats different dates correctly", () => {
		// December 25, 2024 is a Wednesday
		const date = new Date(Date.UTC(2024, 11, 25))
		const result = formatDate(date)

		expect(result).toBe("Wednesday, December 25, 2024")
	})

	it("formats first day of month", () => {
		// January 1, 2025 is a Wednesday
		const date = new Date(Date.UTC(2025, 0, 1))
		const result = formatDate(date)

		expect(result).toBe("Wednesday, January 1, 2025")
	})

	it("preserves calendar date regardless of local timezone", () => {
		// This date at UTC midnight would show as Dec 31 in US Pacific
		// Using UTC methods ensures it displays as Jan 1
		const date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0))
		const result = formatDate(date)

		expect(result).toContain("January 1")
		expect(result).not.toContain("December")
	})
})

describe("getAthleteName", () => {
	it("returns firstName when present", () => {
		expect(getAthleteName({ firstName: "John", email: "john@test.com" })).toBe(
			"John",
		)
	})

	it("returns email prefix when no firstName", () => {
		expect(getAthleteName({ firstName: null, email: "jane.doe@test.com" })).toBe(
			"jane.doe",
		)
	})

	it("returns email prefix when firstName is empty string", () => {
		expect(getAthleteName({ firstName: "", email: "athlete@gym.com" })).toBe(
			"athlete",
		)
	})

	it("returns Athlete fallback when no firstName or email", () => {
		expect(getAthleteName({ firstName: null, email: null })).toBe("Athlete")
	})

	it("returns Athlete fallback when email has no prefix", () => {
		expect(getAthleteName({ firstName: null, email: "@test.com" })).toBe(
			"Athlete",
		)
	})

	it("handles undefined values", () => {
		expect(getAthleteName({})).toBe("Athlete")
	})

	it("prefers firstName over email", () => {
		expect(
			getAthleteName({ firstName: "Preferred", email: "notused@test.com" }),
		).toBe("Preferred")
	})
})

describe("parsePendingTeammateCount", () => {
	it("returns 0 for null input", () => {
		expect(parsePendingTeammateCount(null)).toBe(0)
	})

	it("returns 0 for undefined input", () => {
		expect(parsePendingTeammateCount(undefined)).toBe(0)
	})

	it("returns 0 for empty string", () => {
		expect(parsePendingTeammateCount("")).toBe(0)
	})

	it("returns 0 for invalid JSON", () => {
		expect(parsePendingTeammateCount("not json")).toBe(0)
		expect(parsePendingTeammateCount("{invalid}")).toBe(0)
	})

	it("returns 0 for non-array JSON", () => {
		expect(parsePendingTeammateCount('{"key": "value"}')).toBe(0)
		expect(parsePendingTeammateCount('"string"')).toBe(0)
		expect(parsePendingTeammateCount("123")).toBe(0)
	})

	it("returns count for valid array", () => {
		expect(parsePendingTeammateCount("[]")).toBe(0)
		expect(
			parsePendingTeammateCount('[{"email": "test@test.com"}]'),
		).toBe(1)
		expect(
			parsePendingTeammateCount(
				'[{"email": "a@test.com"}, {"email": "b@test.com"}]',
			),
		).toBe(2)
	})

	it("counts array elements regardless of content", () => {
		expect(parsePendingTeammateCount('[1, 2, 3]')).toBe(3)
		expect(parsePendingTeammateCount('["a", "b", "c", "d"]')).toBe(4)
	})
})

describe("isTeamComplete", () => {
	it("returns true when roster equals max size", () => {
		expect(isTeamComplete(3, 3)).toBe(true)
	})

	it("returns true when roster exceeds max size", () => {
		expect(isTeamComplete(4, 3)).toBe(true)
	})

	it("returns false when roster is below max size", () => {
		expect(isTeamComplete(2, 3)).toBe(false)
		expect(isTeamComplete(0, 3)).toBe(false)
	})

	it("handles individual (team of 1)", () => {
		expect(isTeamComplete(1, 1)).toBe(true)
		expect(isTeamComplete(0, 1)).toBe(false)
	})

	it("handles pairs", () => {
		expect(isTeamComplete(1, 2)).toBe(false)
		expect(isTeamComplete(2, 2)).toBe(true)
	})

	it("handles large teams", () => {
		expect(isTeamComplete(5, 6)).toBe(false)
		expect(isTeamComplete(6, 6)).toBe(true)
	})
})

describe("buildInviteLink", () => {
	it("builds link with default base URL", () => {
		expect(buildInviteLink("abc123")).toBe(
			"https://wodsmith.com/team-invite?token=abc123",
		)
	})

	it("builds link with custom base URL", () => {
		expect(buildInviteLink("xyz789", "https://staging.wodsmith.com")).toBe(
			"https://staging.wodsmith.com/team-invite?token=xyz789",
		)
	})

	it("handles special characters in token", () => {
		expect(buildInviteLink("token-with-dash_underscore")).toBe(
			"https://wodsmith.com/team-invite?token=token-with-dash_underscore",
		)
	})

	it("handles empty token", () => {
		expect(buildInviteLink("")).toBe("https://wodsmith.com/team-invite?token=")
	})

	it("preserves localhost for development", () => {
		expect(buildInviteLink("dev123", "http://localhost:3000")).toBe(
			"http://localhost:3000/team-invite?token=dev123",
		)
	})
})

describe("getTeammateJoinedSubject", () => {
	const baseParams = {
		newTeammateName: "John",
		teamName: "Team Alpha",
		competitionName: "CrossFit Games 2025",
	}

	it("returns complete team subject when team is full", () => {
		const result = getTeammateJoinedSubject({
			...baseParams,
			isTeamComplete: true,
		})

		expect(result).toBe("Your team is complete for CrossFit Games 2025!")
	})

	it("returns teammate joined subject when team is not complete", () => {
		const result = getTeammateJoinedSubject({
			...baseParams,
			isTeamComplete: false,
		})

		expect(result).toBe("John joined Team Alpha")
	})

	it("uses provided names in incomplete team subject", () => {
		const result = getTeammateJoinedSubject({
			newTeammateName: "Jane",
			teamName: "Power Lifters",
			competitionName: "Local Throwdown",
			isTeamComplete: false,
		})

		expect(result).toBe("Jane joined Power Lifters")
	})

	it("uses competition name in complete team subject", () => {
		const result = getTeammateJoinedSubject({
			newTeammateName: "Anyone",
			teamName: "Any Team",
			competitionName: "Special Event 2025",
			isTeamComplete: true,
		})

		expect(result).toBe("Your team is complete for Special Event 2025!")
	})
})

describe("Integration: notification helper combinations", () => {
	it("formats registration confirmation data correctly", () => {
		const user = { firstName: "Jane", email: "jane@crossfit.com" }
		const amountPaidCents = 7500 // $75.00
		const pendingTeammates = '[{"email": "teammate@gym.com"}]'
		// April 1, 2025 is a Tuesday - use UTC to match DB storage
		const registrationDate = new Date(Date.UTC(2025, 3, 1))

		expect(getAthleteName(user)).toBe("Jane")
		expect(formatCents(amountPaidCents)).toBe("$75.00")
		expect(parsePendingTeammateCount(pendingTeammates)).toBe(1)
		expect(formatDate(registrationDate)).toBe("Tuesday, April 1, 2025")
	})

	it("builds complete team notification data", () => {
		const currentSize = 3
		const maxSize = 3
		const complete = isTeamComplete(currentSize, maxSize)

		expect(complete).toBe(true)

		const subject = getTeammateJoinedSubject({
			isTeamComplete: complete,
			newTeammateName: "Final Member",
			teamName: "Dream Team",
			competitionName: "Regionals 2025",
		})

		expect(subject).toBe("Your team is complete for Regionals 2025!")
	})
})
