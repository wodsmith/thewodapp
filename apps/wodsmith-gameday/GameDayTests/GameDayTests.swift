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
}
