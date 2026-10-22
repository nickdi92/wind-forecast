import XCTest
@testable import WindCore

final class WindTests: XCTestCase {
    func testNamesWindByDirectionItComesFrom() {
        XCTAssertEqual(windFrom(0).name, "Tramontana")
        XCTAssertEqual(windFrom(45).name, "Grecale")
        XCTAssertEqual(windFrom(135).name, "Scirocco")
        XCTAssertEqual(windFrom(315).name, "Maestrale")
    }

    func testHalfwayPointsRoundToPreviousSector() {
        XCTAssertEqual(windFrom(22.5).name, "Tramontana")
        XCTAssertEqual(windFrom(22.6).name, "Grecale")
        XCTAssertEqual(windFrom(337.5).name, "Maestrale")
        XCTAssertEqual(windFrom(337.6).name, "Tramontana")
    }

    func testNormalizesOutOfRangeDegrees() {
        XCTAssertEqual(windFrom(360).name, "Tramontana")
        XCTAssertEqual(windFrom(-45).name, "Maestrale")
        XCTAssertEqual(windFrom(405).name, "Grecale")
    }

    func testSouthernWindsAreWarm() {
        XCTAssertTrue(windFrom(135).warm)
        XCTAssertTrue(windFrom(225).warm)
        XCTAssertFalse(windFrom(315).warm)
    }

    func testConvertsAndRoundsSpeed() {
        XCTAssertEqual(SpeedUnit.kmh.convert(23.6), 24)
        XCTAssertEqual(SpeedUnit.kn.convert(37.04), 20)
        XCTAssertEqual(SpeedUnit.ms.convert(36), 10)
        XCTAssertEqual(SpeedUnit.kn.label, "nodi")
    }

    func testBeaufortForce() {
        XCTAssertEqual(beaufort(0).force, 0)
        XCTAssertEqual(beaufort(5.9).force, 1)
        XCTAssertEqual(beaufort(62).force, 8)
        XCTAssertEqual(beaufort(62).label, "Burrasca moderata")
    }
}
