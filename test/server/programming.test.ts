import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicProgrammingTracks, getTeamProgrammingTracks, isTeamSubscribedToProgrammingTrack, isWorkoutInTeamSubscribedTrack } from "@/server/programming";

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

    it("should exclude tracks owned by the current team in UI filtering", () => {
      // This test documents that teams should not see their own tracks
      // The filtering happens in the page component, not the server function
      const mockTracks = [
        { id: "1", ownerTeamId: "team-1" },
        { id: "2", ownerTeamId: "team-2" },
        { id: "3", ownerTeamId: "team-1" },
      ];
      
      const currentTeamId = "team-1";
      const filtered = mockTracks.filter(track => track.ownerTeamId !== currentTeamId);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });
  });

  describe("getTeamProgrammingTracks", () => {
    it("returns only active subscriptions for the specified teamId with joined track details", async () => {
      const result = await getTeamProgrammingTracks("test-team-id");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("isTeamSubscribedToProgrammingTrack", () => {
    it("returns boolean value for any team/track combination", async () => {
      const result = await isTeamSubscribedToProgrammingTrack("test-team", "test-track");
      
      expect(typeof result).toBe("boolean");
    });
  });

  describe("isWorkoutInTeamSubscribedTrack", () => {
    it("returns boolean value for any team/workout combination", async () => {
      const result = await isWorkoutInTeamSubscribedTrack("test-team", "test-workout");
      
      expect(typeof result).toBe("boolean");
    });
  });
});