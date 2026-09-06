import XCTest
@testable import GameDay

final class WorkoutDivisionTests: XCTestCase {
    // @lat: [[gameday#Tests#Native division standards]]
    func testWorkoutDefaultsToAthleteDivisionAndPreservesDownloadedStandards() throws {
        var workout = DemoData.detail.workouts[0]
        workout.divisions = [
            WorkoutDivision(id: "scaled", label: "Scaled", description: "16 kg kettlebell"),
            WorkoutDivision(id: "rx", label: "Individual RX", description: "24 kg kettlebell")
        ]
        XCTAssertEqual(workout.initialDivisionID(registrations: [DemoData.registration]), "rx")
        XCTAssertEqual(workout.initialDivisionID(registrations: []), "scaled")
        let cached = try GameDayJSON.decoder().decode(Workout.self, from: GameDayJSON.encoder().encode(workout))
        XCTAssertEqual(cached.divisions?.last?.description, "24 kg kettlebell")
        workout.divisions = nil
        XCTAssertNil(workout.initialDivisionID(registrations: [DemoData.registration]))
    }
}
