import XCTest

final class AccessibilityLayoutTests: XCTestCase {
    // @lat: [[gameday#Tests#Accessible heat controls]]
    @MainActor
    func testLargestTextKeepsHeatDetailsAndActionsReachable() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        app.tabBars.buttons["My day"].tap()
        XCTAssertTrue(app.staticTexts["Engine Room"].firstMatch.waitForExistence(timeout: 5))
        let countdown = app.buttons["Show on Lock Screen"]
        for _ in 0..<6 where !countdown.isHittable { app.swipeUp() }
        XCTAssertTrue(countdown.isHittable, "The expanded next heat must keep its action reachable by scrolling")
        let expanded = XCTAttachment(screenshot: app.screenshot())
        expanded.name = "Largest text — heat action"
        expanded.lifetime = .keepAlways
        add(expanded)
        let laterHeat = app.staticTexts["Heavy Intentions"].firstMatch
        for _ in 0..<6 where !laterHeat.isHittable { app.swipeUp() }
        XCTAssertTrue(laterHeat.isHittable, "Subsequent heat details must remain reachable")
        let later = XCTAttachment(screenshot: app.screenshot())
        later.name = "Largest text — subsequent heat"
        later.lifetime = .keepAlways
        add(later)
    }
}
