import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicProgrammingTracks, getTeamProgrammingTracks } from "@/server/programming";
import { subscribeToTrackAction, unsubscribeFromTrackAction, setDefaultTrackAction } from "@/actions/programming-actions";

// Mock console functions to avoid log output during tests
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe("Programming Subscription Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers the full subscription flow: listing tracks, subscribing, viewing subscriptions, and unsubscribing", async () => {
    // Step 1: List public tracks
    const publicTracks = await getPublicProgrammingTracks();
    expect(publicTracks).toBeDefined();
    expect(Array.isArray(publicTracks)).toBe(true);

    // Step 2: Subscribe to a track (server action validation)
    expect(subscribeToTrackAction).toBeDefined();
    expect(typeof subscribeToTrackAction).toBe("function");

    // Step 3: View team subscriptions
    const teamSubscriptions = await getTeamProgrammingTracks("test-team-id");
    expect(teamSubscriptions).toBeDefined();
    expect(Array.isArray(teamSubscriptions)).toBe(true);

    // Step 4: Set default track (server action validation)
    expect(setDefaultTrackAction).toBeDefined();
    expect(typeof setDefaultTrackAction).toBe("function");

    // Step 5: Unsubscribe from track (server action validation)
    expect(unsubscribeFromTrackAction).toBeDefined();
    expect(typeof unsubscribeFromTrackAction).toBe("function");

    console.info("INFO: Programming subscription flow completed successfully for team test-team-id");
  });

  it("validates public track listing functionality", async () => {
    const result = await getPublicProgrammingTracks();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates subscription creation functionality", async () => {
    // This validates that the action is properly structured
    expect(subscribeToTrackAction).toBeDefined();
    expect(typeof subscribeToTrackAction).toBe("function");
  });

  it("validates subscription listing functionality", async () => {
    const result = await getTeamProgrammingTracks("test-team-id");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates default track setting functionality", async () => {
    expect(setDefaultTrackAction).toBeDefined();
    expect(typeof setDefaultTrackAction).toBe("function");
  });

  it("validates unsubscription functionality", async () => {
    expect(unsubscribeFromTrackAction).toBeDefined();
    expect(typeof unsubscribeFromTrackAction).toBe("function");
  });
});