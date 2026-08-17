import { describe, expect, it } from "vitest"
import { formatLeaderboardPoints } from "@/lib/scoring"

describe("formatLeaderboardPoints", () => {
	it("keeps existing sign behavior for placement-style algorithms", () => {
		expect(formatLeaderboardPoints(7, "traditional")).toBe("+7")
		expect(formatLeaderboardPoints(7, "online")).toBe("7")
		expect(formatLeaderboardPoints(-2, "p_score")).toBe("-2")
	})
})
