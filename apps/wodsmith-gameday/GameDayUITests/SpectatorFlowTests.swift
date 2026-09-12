import XCTest

final class SpectatorFlowTests: XCTestCase {
    // @lat: [[gameday#Tests#Anonymous spectator navigation]]
    @MainActor
    func testAnonymousFollowingScheduleAndRelaunch() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo", "--spectator-demo"]
        app.launch()
        app.buttons["Competition filters"].tap()
        app.buttons["Include past competitions"].tap()
        app.staticTexts["Summit Throwdown"].firstMatch.tap()
        XCTAssertTrue(app.buttons["spectateCompetition"].waitForExistence(timeout: 5))
        if app.buttons["spectateCompetition"].label == "Spectate" { app.buttons["spectateCompetition"].tap() }
        app.staticTexts["Manage"].tap()
        for name in ["Jordan Lee", "Summit Crew"] {
            if app.buttons["Follow \(name)"].exists { app.buttons["Follow \(name)"].tap() }
            XCTAssertTrue(app.buttons["Unfollow \(name)"].exists)
        }
        let follows = XCTAttachment(screenshot: app.screenshot()); follows.name = "spectator-follows"; follows.lifetime = .keepAlways; add(follows)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.staticTexts["Jordan Lee · Lane 2"].waitForExistence(timeout: 5))
        let hub = XCTAttachment(screenshot: app.screenshot()); hub.name = "spectator-competition"; hub.lifetime = .keepAlways; add(hub)
        app.staticTexts["Full schedule"].tap()
        XCTAssertTrue(app.buttons["Heats, Following"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Jordan Lee · Lane 2"].exists)
        XCTAssertTrue(app.staticTexts["Summit Crew · Lane 5"].exists)
        XCTAssertFalse(app.staticTexts["Leave No Doubt"].exists)
        let heats = XCTAttachment(screenshot: app.screenshot()); heats.name = "spectator-heats"; heats.lifetime = .keepAlways; add(heats)
        app.buttons["Filter divisions"].tap()
        app.buttons["Teams RX"].tap()
        XCTAssertFalse(app.staticTexts["Engine Room"].exists)
        XCTAssertTrue(app.staticTexts["Summit Crew · Lane 5"].exists)
        app.buttons["Filter divisions"].tap()
        app.buttons["Individual RX"].tap()
        XCTAssertTrue(app.staticTexts["Jordan Lee · Lane 2"].exists)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.staticTexts["Leaderboard"].tap()
        XCTAssertTrue(app.staticTexts["Jordan Lee"].waitForExistence(timeout: 5))
        app.buttons["Following"].tap()
        XCTAssertFalse(app.staticTexts["Sam Rivera"].exists)
        XCTAssertFalse(app.staticTexts["All divisions"].exists)
        app.buttons["Division, Individual RX"].tap()
        app.buttons["Teams RX"].tap()
        XCTAssertTrue(app.staticTexts["Summit Crew"].exists)
        let board = XCTAttachment(screenshot: app.screenshot()); board.name = "spectator-leaderboard"; board.lifetime = .keepAlways; add(board)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["Spectating"].waitForExistence(timeout: 5))
        app.staticTexts["Summit Throwdown"].firstMatch.tap()
        app.staticTexts["Manage"].tap()
        XCTAssertTrue(app.buttons["Unfollow Jordan Lee"].waitForExistence(timeout: 5))
        app.buttons["Unfollow Jordan Lee"].tap()
        XCTAssertTrue(app.buttons["Follow Jordan Lee"].exists)
        app.buttons["Unfollow Summit Crew"].tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.staticTexts["Follow athletes or teams to see their next heats here. Saved on this device; no account needed."].exists)
    }
    // @lat: [[gameday#Tests#Accessible spectator controls]]
    @MainActor
    func testLargeTextAndLandscapeFollowControls() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo", "--spectator-demo", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        app.buttons["Competition filters"].tap()
        app.buttons["Include past competitions"].tap()
        app.staticTexts["Summit Throwdown"].firstMatch.tap()
        for _ in 0..<3 where !app.staticTexts["Manage"].isHittable { app.swipeUp() }
        app.staticTexts["Manage"].tap()
        if app.buttons["Unfollow Jordan Lee"].exists { app.buttons["Unfollow Jordan Lee"].tap() }
        let follow = app.buttons["Follow Jordan Lee"]
        for _ in 0..<3 where !follow.isHittable { app.swipeUp() }
        XCTAssertTrue(follow.isHittable)
        follow.tap()
        XCTAssertTrue(app.buttons["Unfollow Jordan Lee"].exists)
        let large = XCTAttachment(screenshot: app.screenshot()); large.name = "spectator-largest-text"; large.lifetime = .keepAlways; add(large)
        XCUIDevice.shared.orientation = .landscapeLeft
        app.swipeUp()
        XCTAssertTrue(app.buttons["Unfollow Jordan Lee"].exists)
        let landscape = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); landscape.name = "spectator-landscape"; landscape.lifetime = .keepAlways; add(landscape)
        XCUIDevice.shared.orientation = .portrait
    }

}
