import XCTest

final class GameDayUITests: XCTestCase {
    // @lat: [[gameday#Tests#Live Activity controls]]
    @MainActor
    func testAthleteCanStartAndEndLiveActivity() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo"]
        app.launch()
        app.tabBars.buttons["My day"].tap()
        let start = app.buttons["Show on Lock Screen"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        start.tap()
        let end = app.buttons["End Lock Screen countdown"]
        XCTAssertTrue(end.waitForExistence(timeout: 5), "Starting must complete and expose the end action")
        end.tap()
        XCTAssertTrue(start.waitForExistence(timeout: 5), "Ending must complete and restore the start action")
    }

    // @lat: [[gameday#Tests#Athlete navigation]]
    @MainActor
    func testAthleteCanOpenPersonalScheduleAndCompetitionPages() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo"]
        app.launch()
        XCTAssertTrue(app.navigationBars["Competitions"].waitForExistence(timeout: 10))
        app.tabBars.buttons["My day"].tap()
        XCTAssertTrue(app.staticTexts["Engine Room"].firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Show on Lock Screen"].exists)
        app.staticTexts["Summit Throwdown"].firstMatch.tap()
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["Leaderboard"].waitForExistence(timeout: 5))
        app.staticTexts["Leaderboard"].tap()
        XCTAssertTrue(app.staticTexts["Alex Morgan"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Heat reminders"].tap()
        XCTAssertTrue(app.switches["Remind me before my heats"].waitForExistence(timeout: 5))
    }
}
