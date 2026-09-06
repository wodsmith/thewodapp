import XCTest

final class AccessibilityLayoutTests: XCTestCase {
    // @lat: [[gameday#Tests#Accessible competition discovery]]
    @MainActor
    func testLargestTextKeepsDiscoveryAndFreshnessReadable() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"]
        app.launch()
        let updated = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Updated '")).firstMatch
        for _ in 0..<6 where !updated.isHittable { app.swipeUp() }
        XCTAssertTrue(updated.isHittable)
        let standardHeight = updated.frame.height
        app.terminate()
        app.launchArguments = ["--demo", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.searchFields.firstMatch.waitForExistence(timeout: 5))
        let discovery = XCTAttachment(screenshot: app.screenshot())
        discovery.name = "Largest text — discovery and registration"
        discovery.lifetime = .keepAlways
        add(discovery)
        for _ in 0..<8 where !updated.isHittable { app.swipeUp() }
        XCTAssertTrue(updated.isHittable, "The freshness timestamp must remain reachable")
        XCTAssertGreaterThan(updated.frame.height, standardHeight, "The timestamp must grow with Dynamic Type")
        let footer = XCTAttachment(screenshot: app.screenshot())
        footer.name = "Largest text — discovery freshness"
        footer.lifetime = .keepAlways
        add(footer)
    }

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
