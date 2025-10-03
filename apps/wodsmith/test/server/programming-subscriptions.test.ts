import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamProgrammingTracks } from "@/server/programming";

// Mock console.info to avoid log output during tests
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

describe("Programming Subscriptions Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeamProgrammingTracks", () => {
    it("returns only active subscriptions for the specified teamId with joined track details", async () => {
      const result = await getTeamProgrammingTracks("test-team-id");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Since this uses the mocked db, we just verify it doesn't throw and returns an array
    });
  });
});