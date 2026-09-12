import XCTest
@testable import GameDay

final class SpectatorTests: XCTestCase {
    // @lat: [[gameday#Tests#Spectator persistence]]
    @MainActor
    func testFollowsPersistAcrossRelaunchAndSignOutAndRemainCompetitionScoped() async throws {
        let suite = "spectator-tests-\(UUID())"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let preferences = SpectatorPreferences(defaults: defaults)
        preferences.setSpectating("a", enabled: true)
        preferences.toggleFollow("team", competitionID: "a")
        preferences.toggleFollow("athlete", competitionID: "a")
        XCTAssertTrue(preferences.followedIDs("b").isEmpty)
        let restored = SpectatorPreferences(defaults: defaults)
        XCTAssertEqual(restored.followedIDs("a"), ["team", "athlete"])
        let store = GameDayStore(demo: true, spectator: restored)
        await store.signOut()
        XCTAssertEqual(restored.followedIDs("a"), ["team", "athlete"])
        restored.toggleFollow("team", competitionID: "a")
        XCTAssertEqual(SpectatorPreferences(defaults: defaults).followedIDs("a"), ["athlete"])
        restored.setSpectating("a", enabled: false)
        XCTAssertFalse(SpectatorPreferences(defaults: defaults).competitionIDs.contains("a"))
    }

    // @lat: [[gameday#Tests#Public follow heat mapping]]
    func testFollowsUseExplicitAssignmentsAcrossDivisionsAndNeverGuess() throws {
        var detail = DemoData.spectatorDetail
        XCTAssertEqual(detail.spectatorHeats(followedIDs: ["athlete-0"]).map(\.id), ["heat-1"])
        XCTAssertEqual(detail.spectatorHeats(followedIDs: ["athlete-0", "team-summit"]).map(\.id), ["heat-1", "heat-2"])
        XCTAssertEqual(detail.spectatorHeats(followedIDs: ["athlete-0", "team-summit"], divisionIDs: ["teams"]).map(\.id), ["heat-2"])
        XCTAssertEqual(detail.spectatorHeats(followedIDs: ["athlete-0", "team-summit"], divisionIDs: ["rx", "teams"]).count, 2)
        XCTAssertEqual(detail.followedLaneLabels(for: detail.heats[1], ids: ["team-summit"]), ["Summit Crew · Lane 5"])
        XCTAssertTrue(detail.myHeats.isEmpty, "Public lanes never confer athlete ownership")
        XCTAssertTrue(detail.spectatorHeats(followedIDs: []).isEmpty)
        XCTAssertTrue(detail.spectatorHeats(followedIDs: ["removed"]).isEmpty)
        detail.publicAssignments = nil
        XCTAssertTrue(detail.spectatorHeats(followedIDs: ["athlete-0"]).isEmpty)
        XCTAssertEqual(detail.spectatorHeats(followedIDs: nil).count, 3)
        let decoded = try GameDayJSON.decoder().decode(CompetitionDetail.self, from: GameDayJSON.encoder().encode(DemoData.spectatorDetail))
        XCTAssertEqual(decoded.spectatorHeats(followedIDs: ["team-summit"]).map(\.id), ["heat-2"])
    }
}
