import XCTest
@testable import GameDay

final class GameDayTests: XCTestCase {
    // @lat: [[gameday#Tests#Competition local day boundary]]
    func testDiscoveryKeepsCompetitionUntilItsLocalDayEnds() throws {
        let competition = DemoData.detail.competition
        let formatter = ISO8601DateFormatter()
        let utcTomorrow = try XCTUnwrap(formatter.date(from: "2026-09-07T01:00:00Z"))
        let localTomorrow = try XCTUnwrap(formatter.date(from: "2026-09-07T06:00:00Z"))
        XCTAssertFalse(competition.hasEnded(at: utcTomorrow), "An evening heat in Boise is still on the competition's final day")
        XCTAssertTrue(competition.hasEnded(at: localTomorrow), "The event ends at its own timezone's midnight")
    }

    // @lat: [[gameday#Tests#Assigned heats only]]
    func testPersonalScheduleRequiresActiveRegistrationAndAssignment() {
        let source = DemoData.detail
        let unrelated = HeatAssignment(heatId: "heat-2", registrationId: "someone-else", lane: 7)
        let detail = CompetitionDetail(competition: source.competition, registrations: source.registrations,
            heats: source.heats, assignments: [source.assignments[0], unrelated], workouts: [], announcements: [])
        XCTAssertEqual(detail.myHeats.map(\.id), ["heat-1"])
        XCTAssertNil(detail.lane(for: source.heats[1]))
        XCTAssertEqual(detail.lane(for: source.heats[0]), 4)
    }

    // @lat: [[gameday#Tests#Next heat transitions]]
    func testNextHeatIncludesCurrentHeatThenAdvances() throws {
        let detail = DemoData.detail
        let first = try XCTUnwrap(detail.heats.first)
        let start = try XCTUnwrap(first.startsAt)
        let end = try XCTUnwrap(first.endsAt)
        XCTAssertEqual(detail.nextHeat(at: start.addingTimeInterval(-1))?.id, first.id)
        XCTAssertEqual(detail.nextHeat(at: start.addingTimeInterval(1))?.id, first.id)
        XCTAssertEqual(detail.nextHeat(at: end)?.id, "heat-2")
        XCTAssertNil(detail.nextHeat(at: .distantFuture))
    }

    // @lat: [[gameday#Tests#Reminder lead times]]
    func testRemindersUseLeadTimeAndNeverScheduleInThePast() throws {
        let detail = DemoData.detail
        let firstStart = try XCTUnwrap(detail.heats.first?.startsAt)
        let before = ReminderPlanner.plan(details: [detail], minutes: 15, now: firstStart.addingTimeInterval(-901))
        XCTAssertEqual(before.first?.fireAt, firstStart.addingTimeInterval(-900))
        XCTAssertEqual(before.first?.id, "heat.heat-1")
        XCTAssertTrue(before.first?.body.contains("Lane 4") == true)
        let after = ReminderPlanner.plan(details: [detail], minutes: 15, now: firstStart.addingTimeInterval(-899))
        XCTAssertFalse(after.contains { $0.id == "heat.heat-1" })
        XCTAssertTrue(ReminderPlanner.plan(details: [], minutes: 15).isEmpty)
    }

    // @lat: [[gameday#Tests#Server dates]]
    func testJSONAcceptsFractionalAndWholeSecondDatesAndKeepsDateOnlyValues() throws {
        struct Dates: Decodable { let fractional: Date; let whole: Date }
        let data = Data(#"{"fractional":"2026-09-05T17:30:00.000Z","whole":"2026-09-05T17:30:00Z"}"#.utf8)
        let dates = try GameDayJSON.decoder().decode(Dates.self, from: data)
        XCTAssertEqual(dates.fractional, dates.whole)
        let encoded = try GameDayJSON.encoder().encode(DemoData.detail)
        let decoded = try GameDayJSON.decoder().decode(CompetitionDetail.self, from: encoded)
        XCTAssertEqual(decoded.competition.startDate, "2026-09-05")
        XCTAssertEqual(decoded.myHeats.count, 3)
        XCTAssertThrowsError(try GameDayJSON.decoder().decode(Dates.self, from: Data(#"{"fractional":"not-a-date","whole":"2026-09-05T17:30:00Z"}"#.utf8)))
    }
    // @lat: [[gameday#Tests#Athlete competition defaults]]
    func testAthleteDefaultsUseAllActiveRegistrationsAndKeepDivisionIdentity() throws {
        let competitionID = DemoData.competition.id
        func registration(_ id: String, _ division: String, days: Double, status: String = "active", competition: String? = nil) -> Registration {
            Registration(id: id, competitionId: competition ?? competitionID, divisionId: division, division: "Same label", teamName: "Team", status: status, checkedInAt: nil, paymentStatus: nil, registeredAt: Date(timeIntervalSince1970: days * 86400))
        }
        let first = registration("team", "team-rx", days: 1)
        let second = registration("individual", "rx", days: 2)
        let registrations = [second, registration("removed", "removed", days: 0, status: "removed"),
            registration("other", "other", days: 0, competition: "other-competition"), first,
            registration("duplicate", "team-rx", days: 3)]
        let divisions = AthleteCompetitionDefaults.leaderboardDivisions(entries: DemoData.leaderboard.entries,
            registrations: registrations, competitionID: competitionID)
        XCTAssertEqual(divisions.map(\.id), ["team-rx", "rx"])
        XCTAssertEqual(AthleteCompetitionDefaults.selectedDivisionID(nil, divisions: divisions), "team-rx", "A team registration without results still defaults to its own division")
        XCTAssertEqual(AthleteCompetitionDefaults.selectedDivisionID("rx", divisions: divisions), "rx", "Refresh preserves a deliberate division choice")
        XCTAssertEqual(AthleteCompetitionDefaults.selectedDivisionID("removed", divisions: divisions), "team-rx")
        let spectator = AthleteCompetitionDefaults.leaderboardDivisions(entries: DemoData.leaderboard.entries, registrations: [], competitionID: competitionID)
        XCTAssertEqual(AthleteCompetitionDefaults.selectedDivisionID(nil, divisions: spectator), "rx")
        XCTAssertNil(AthleteCompetitionDefaults.selectedDivisionID(nil, divisions: []))

        let source = DemoData.detail
        let detail = CompetitionDetail(competition: source.competition, registrations: [first, second], heats: source.heats,
            assignments: [HeatAssignment(heatId: "heat-1", registrationId: first.id, lane: 1),
                HeatAssignment(heatId: "heat-2", registrationId: second.id, lane: 2)], workouts: [], announcements: [])
        XCTAssertEqual(AthleteCompetitionDefaults.scheduleHeats(detail: detail, onlyMine: nil).map(\.id), ["heat-1", "heat-2"])
        XCTAssertEqual(AthleteCompetitionDefaults.scheduleHeats(detail: detail, onlyMine: false).count, 3)
        let noAssignments = CompetitionDetail(competition: source.competition, registrations: [first], heats: source.heats, assignments: [], workouts: [], announcements: [])
        XCTAssertTrue(AthleteCompetitionDefaults.scheduleHeats(detail: noAssignments, onlyMine: nil).isEmpty)
        let publicDetail = CompetitionDetail(competition: source.competition, registrations: [], heats: source.heats, assignments: [], workouts: [], announcements: [])
        XCTAssertEqual(AthleteCompetitionDefaults.scheduleHeats(detail: publicDetail, onlyMine: nil).count, 3)
    }

    // @lat: [[gameday#Tests#Registered competition relevance]]
    func testRegisteredCompetitionsPutUpcomingBeforePast() throws {
        let nextRegistration = Registration(id: "next", competitionId: DemoData.second.id, divisionId: nil, division: nil,
            teamName: nil, status: "active", checkedInAt: nil, paymentStatus: nil, registeredAt: .now)
        let home = HomeResponse(competitions: [DemoData.competition, DemoData.second], registrations: [DemoData.registration, nextRegistration], profile: nil)
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-09-12T12:00:00Z"))
        XCTAssertEqual(home.orderedMyCompetitions(at: now).map(\.id), [DemoData.second.id, DemoData.competition.id])
    }

}
