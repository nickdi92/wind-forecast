import XCTest
@testable import WindCore

final class RainTests: XCTestCase {
    private func point(rain: Double, chance: Double) -> HourPoint {
        HourPoint(time: "2026-10-22T13:00", speed: 10, gust: 15, dir: 300, rain: rain, rainChance: chance)
    }

    func testSaysNothingWhenItStaysDry() {
        XCTAssertNil(rainShort(point(rain: 0.05, chance: 29)))
    }

    func testGivesTheChanceWhenRainIsOnlyPossible() {
        XCTAssertEqual(rainShort(point(rain: 0, chance: 30)), "30%")
        XCTAssertEqual(rainShort(point(rain: 0, chance: 64.6)), "65%")
    }

    func testGivesTheAmountWhenRainIsExpected() {
        XCTAssertEqual(rainShort(point(rain: 0.1, chance: 20)), "0,1 mm")
        XCTAssertEqual(rainShort(point(rain: 1.62, chance: 20)), "1,6 mm")
        XCTAssertEqual(rainShort(point(rain: 3, chance: 90)), "3 mm")
        XCTAssertEqual(rainShort(point(rain: 12.34, chance: 95)), "12 mm")
    }
}
