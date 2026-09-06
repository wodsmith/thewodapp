import XCTest

final class WorkoutFlowTests: XCTestCase {
    // @lat: [[gameday#Tests#Workout standards navigation]]
    @MainActor
    func testAthleteReadsNativeDivisionStandardsInPortraitAndLandscape() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo"]
        app.launch()
        app.staticTexts["Summit Throwdown"].firstMatch.tap()
        let workouts = app.staticTexts["Workouts"].firstMatch
        for _ in 0..<5 where !workouts.isHittable { app.collectionViews.firstMatch.exists ? app.collectionViews.firstMatch.swipeUp() : app.swipeUp() }
        workouts.tap()
        app.staticTexts["Engine Room"].firstMatch.tap()
        let standard = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Kettlebell: 24 kg / 16 kg.")).firstMatch
        for _ in 0..<4 where !standard.isHittable { app.collectionViews.firstMatch.exists ? app.collectionViews.firstMatch.swipeUp() : app.swipeUp() }
        XCTAssertTrue(standard.isHittable)
        let portrait = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        portrait.name = "Native workout standards — portrait"
        portrait.lifetime = .keepAlways
        add(portrait)
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        for _ in 0..<4 where !standard.isHittable { app.collectionViews.firstMatch.exists ? app.collectionViews.firstMatch.swipeUp() : app.swipeUp() }
        XCTAssertTrue(standard.isHittable)
        let landscape = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        landscape.name = "Native workout standards — landscape"
        landscape.lifetime = .keepAlways
        add(landscape)
    }
}
