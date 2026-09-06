import XCTest

final class GameDayUITests: XCTestCase {
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
