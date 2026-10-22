import XCTest
@testable import WindCore

final class AlertTests: XCTestCase {
    private func hours(_ gusts: [Double]) -> [HourPoint] {
        gusts.enumerated().map { i, g in
            HourPoint(time: String(format: "2026-10-22T%02d:00", 10 + i), speed: g * 0.6, gust: g, dir: Double(i * 10))
        }
    }

    func testNoAlertBelowWarningThreshold() {
        XCTAssertNil(gustAlert(hours([10, 39.9, 20])))
    }

    func testWarningSpansFirstToLastStrongHour() {
        let a = gustAlert(hours([10, 42, 30, 45, 20]))!
        XCTAssertEqual(a.level, .attenzione)
        XCTAssertEqual(a.start, "2026-10-22T11:00")
        XCTAssertEqual(a.end, "2026-10-22T13:00")
        XCTAssertEqual(a.maxGust, 45)
        XCTAssertEqual(a.dir, 30)
        XCTAssertFalse(a.ongoing)
    }

    func testOnlyFirstSpellWhenALongLullSeparatesTwo() {
        let a = gustAlert(hours([68, 63, 20, 20, 20, 75, 41]))!
        XCTAssertEqual(a.start, "2026-10-22T10:00")
        XCTAssertEqual(a.end, "2026-10-22T11:00")
        XCTAssertEqual(a.maxGust, 68)
        XCTAssertTrue(a.ongoing)
    }

    func testLevelComesFromFirstSpellOnly() {
        XCTAssertEqual(gustAlert(hours([45, 20, 20, 20, 70]))?.level, .attenzione)
    }

    func testDangerWhenPeakReachesSixty() {
        let a = gustAlert(hours([60, 20]))!
        XCTAssertEqual(a.level, .pericolo)
        XCTAssertTrue(a.ongoing)
    }
}

final class AlertPlanTests: XCTestCase {
    private let now = romeDate("2026-10-22T09:20")
    /** Gusts of 65 km/h from 14:00 to 17:00 on the 22nd. */
    private let storm = snapshot(gust: { (14...17).contains($0) ? 65 : 20 })

    func testNoAlertMeansNothingToSend() {
        let plan = planAlerts(snapshot: snapshot(), now: now, notified: [], unit: .kmh, deliverHeadsUp: true)
        XCTAssertNil(plan.headsUp)
        XCTAssertNil(plan.reminder)
        XCTAssertEqual(plan.notified, [])
    }

    func testNewAlertSendsHeadsUpAndRemembersWindow() {
        let plan = planAlerts(snapshot: storm, now: now, notified: [], unit: .kmh, deliverHeadsUp: true)
        XCTAssertEqual(plan.headsUp?.title, "Pericolo raffiche a Olbia")
        XCTAssertEqual(
            plan.headsUp?.body,
            "Fino a 65 km/h da nord-ovest, oggi dalle 14 alle 18. Ritira tendalino e accessori, evita viadotti e strade esposte. Parcheggia con il muso verso nord-ovest."
        )
        XCTAssertEqual(plan.notified, [NotifiedWindow(level: .pericolo, start: romeDate("2026-10-22T14:00"), end: romeDate("2026-10-22T18:00"))])
    }

    func testRemindsOneHourBeforeStart() {
        let plan = planAlerts(snapshot: storm, now: now, notified: [], unit: .kn, deliverHeadsUp: true)
        XCTAssertEqual(plan.reminder?.date, romeDate("2026-10-22T13:00"))
        XCTAssertEqual(plan.reminder?.message.title, "Tra un'ora raffiche a Olbia")
        XCTAssertTrue(plan.reminder!.message.body.hasPrefix("Fino a 35 nodi da nord-ovest, dalle 14 alle 18."))
    }

    func testForegroundRunRemembersWindowWithoutHeadsUp() {
        let plan = planAlerts(snapshot: storm, now: now, notified: [], unit: .kmh, deliverHeadsUp: false)
        XCTAssertNil(plan.headsUp)
        XCTAssertNotNil(plan.reminder)
        XCTAssertEqual(plan.notified.count, 1)
    }

    func testSameWindowIsNotAnnouncedTwiceEvenIfItShifts() {
        let first = planAlerts(snapshot: storm, now: now, notified: [], unit: .kmh, deliverHeadsUp: true)
        let shifted = snapshot(gust: { (15...18).contains($0) ? 62 : 20 })
        let second = planAlerts(snapshot: shifted, now: now, notified: first.notified, unit: .kmh, deliverHeadsUp: true)
        XCTAssertNil(second.headsUp)
        XCTAssertEqual(second.notified, first.notified)
    }

    func testOneHourSpellMovedByAnHourIsTheSameStorm() {
        let first = planAlerts(snapshot: snapshot(gust: { $0 == 14 ? 65 : 20 }), now: now, notified: [], unit: .kmh, deliverHeadsUp: true)
        let moved = planAlerts(snapshot: snapshot(gust: { $0 == 15 ? 65 : 20 }), now: now, notified: first.notified, unit: .kmh, deliverHeadsUp: true)
        XCTAssertNil(moved.headsUp)
    }

    func testSpellAfterALongLullIsNews() {
        let first = planAlerts(snapshot: snapshot(gust: { (10...11).contains($0) ? 65 : 20 }), now: romeDate("2026-10-22T09:00"), notified: [], unit: .kmh, deliverHeadsUp: true)
        // The morning spell is over; a new one starts three hours after it ended.
        let later = planAlerts(snapshot: snapshot(gust: { (15...16).contains($0) ? 65 : 20 }), now: romeDate("2026-10-22T12:30"), notified: first.notified, unit: .kmh, deliverHeadsUp: true)
        XCTAssertNotNil(later.headsUp)
    }

    func testEscalationFromWarningToDangerIsAnnounced() {
        let warning = snapshot(gust: { (14...17).contains($0) ? 45 : 20 })
        let first = planAlerts(snapshot: warning, now: now, notified: [], unit: .kmh, deliverHeadsUp: true)
        XCTAssertEqual(first.headsUp?.title, "Raffiche forti a Olbia")
        let second = planAlerts(snapshot: storm, now: now, notified: first.notified, unit: .kmh, deliverHeadsUp: true)
        XCTAssertEqual(second.headsUp?.title, "Pericolo raffiche a Olbia")
        XCTAssertEqual(second.notified.count, 2)
    }

    func testOngoingAlertHasNoReminder() {
        let plan = planAlerts(snapshot: storm, now: romeDate("2026-10-22T15:10"), notified: [], unit: .kmh, deliverHeadsUp: true)
        XCTAssertNil(plan.reminder)
        XCTAssertTrue(plan.headsUp!.body.contains("adesso e fino alle 18"))
    }

    func testTomorrowIsSpelledOut() {
        let night = snapshot(gust: { (27...29).contains($0) ? 48 : 20 })
        let plan = planAlerts(snapshot: night, now: romeDate("2026-10-22T20:00"), notified: [], unit: .kmh, deliverHeadsUp: true)
        XCTAssertTrue(plan.headsUp!.body.contains("domani dalle 03 alle 06"))
    }

    func testForgetsWindowsEndedMoreThanADayAgo() {
        let old = NotifiedWindow(level: .pericolo, start: romeDate("2026-10-20T10:00"), end: romeDate("2026-10-20T12:00"))
        let plan = planAlerts(snapshot: snapshot(), now: now, notified: [old], unit: .kmh, deliverHeadsUp: true)
        XCTAssertEqual(plan.notified, [])
    }
}
