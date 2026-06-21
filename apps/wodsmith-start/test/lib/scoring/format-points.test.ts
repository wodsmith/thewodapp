import { describe, expect, it } from "vitest"
import { formatLeaderboardPoints } from "@/lib/scoring"

describe("formatLeaderboardPoints", () => {
	it("preserves absolute-tier half tiers without a positive-points prefix", () => {
		expect(formatLeaderboardPoints(0.5, "absolute_tier")).toBe("0.5")
		expect(formatLeaderboardPoints(7, "absolute_tier")).toBe("7")
	})

	it("keeps existing sign behavior for placement-style algorithms", () => {
		expect(formatLeaderboardPoints(7, "traditional")).toBe("+7")
		expect(formatLeaderboardPoints(7, "online")).toBe("7")
		expect(formatLeaderboardPoints(-2, "p_score")).toBe("-2")
	})
})
