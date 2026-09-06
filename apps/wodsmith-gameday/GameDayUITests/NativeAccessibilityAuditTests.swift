import XCTest

final class NativeAccessibilityAuditTests: XCTestCase {
    // @lat: [[gameday#Tests#Discovery accessibility audit]]
    @MainActor
    func testCompetitionDiscoveryAccessibility() throws {
        let app = launchApp()
        XCTAssertTrue(app.navigationBars["Competitions"].waitForExistence(timeout: 10))
        try audit(app)
    }

    // @lat: [[gameday#Tests#Personal schedule accessibility audit]]
    @MainActor
    func testPersonalScheduleAccessibility() throws {
        let app = launchApp()
        app.tabBars.buttons["My day"].tap()
        XCTAssertTrue(app.staticTexts["Engine Room"].firstMatch.waitForExistence(timeout: 5))
        try audit(app)
    }

    // @lat: [[gameday#Tests#Reminder settings accessibility audit]]
    @MainActor
    func testReminderSettingsAccessibility() throws {
        let app = launchApp()
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Heat reminders"].tap()
        XCTAssertTrue(app.switches["Remind me before my heats"].waitForExistence(timeout: 5))
        try app.performAccessibilityAudit()
    }

    @MainActor
    private func launchApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--demo"]
        app.launch()
        return app
    }

    @MainActor
    private func audit(_ app: XCUIApplication) throws {
        try app.performAccessibilityAudit { issue in
            let version = ProcessInfo.processInfo.operatingSystemVersion
            guard version.majorVersion == 26, version.minorVersion == 2,
                  let element = issue.element else { return false }
            // These exact iOS 26.2 flags were checked against simulator captures.
            // Discovery growth/reachability is separately exercised at AX5.
            // See AppStore/design-review.md; all other findings still fail.
            let reviewed: Bool
            switch issue.auditType {
            case .textClipped:
                reviewed = (element.elementType == .searchField && element.label == "Search")
                    || (element.elementType == .staticText && element.label == "Registered")
            case .dynamicType:
                reviewed = element.elementType == .staticText && element.label.hasPrefix("Updated ")
            case .contrast:
                reviewed = element.elementType == .staticText && element.label == "Heat reminders"
            default:
                reviewed = false
            }
            if reviewed {
                let evidence = XCTAttachment(string: "Reviewed iOS 26.2 audit exception: \(element.label) — \(issue.compactDescription)")
                evidence.lifetime = .keepAlways
                self.add(evidence)
            }
            return reviewed
        }
    }
}
