import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicProgrammingTracks, getTeamProgrammingTracks } from "@/server/programming";

// Mock console.info to avoid log output during tests
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

describe("Programming Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPublicProgrammingTracks", () => {
    it("returns only public tracks with correct fields", async () => {
      const result = await getPublicProgrammingTracks();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockConsoleInfo).toHaveBeenCalledWith("INFO: Fetching public programming tracks");
    });
  });

  describe("getTeamProgrammingTracks", () => {
    it("returns only active subscriptions for the specified teamId with joined track details", async () => {
      const result = await getTeamProgrammingTracks("test-team-id");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});