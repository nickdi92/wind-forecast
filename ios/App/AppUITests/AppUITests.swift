import XCTest

/// End-to-end checks of the app shell around the web page. Needs network: the forecast comes from Open-Meteo.
final class AppUITests: XCTestCase {
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    override func setUp() {
        continueAfterFailure = false
    }

    /// Accepts the system permission alert, whichever language the simulator speaks.
    private func allowSystemAlert() {
        let labels = ["Allow", "Consenti", "Allow While Using App", "Consenti mentre usi l’app"]
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            if let button = labels.lazy.map({ self.springboard.buttons[$0] }).first(where: \.exists) {
                button.tap()
                return
            }
            usleep(250_000)
        }
    }

    private func scrollTo(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<12 where !element.isHittable {
            app.swipeUp()
        }
    }

    func testTurnsGustAlertsOnAndOff() {
        let app = XCUIApplication()
        app.launch()
        allowSystemAlert() // location, on a fresh simulator

        let enable = app.buttons["Attiva avvisi"]
        let disable = app.buttons["Disattiva avvisi"]
        XCTAssertTrue(enable.waitForExistence(timeout: 40) || disable.exists, "alerts panel never appeared")
        if disable.exists {
            scrollTo(disable, in: app)
            disable.tap()
            XCTAssertTrue(enable.waitForExistence(timeout: 5))
        }

        scrollTo(enable, in: app)
        enable.tap()
        allowSystemAlert()

        XCTAssertTrue(disable.waitForExistence(timeout: 10), "alerts did not turn on")
        let summary = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'Attivi per'")).firstMatch
        XCTAssertTrue(summary.exists)

        disable.tap()
        XCTAssertTrue(enable.waitForExistence(timeout: 5), "alerts did not turn off")
    }
}
