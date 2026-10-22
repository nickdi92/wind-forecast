import XCTest
@testable import WindCore

final class SharedStoreTests: XCTestCase {
    private var store: SharedStore!

    override func setUp() {
        store = SharedStore(defaults: UserDefaults(suiteName: "test-\(UUID().uuidString)")!)
    }

    func testDefaultsWhenEmpty() {
        XCTAssertNil(store.snapshot)
        XCTAssertEqual(store.unit, .kmh)
        XCTAssertFalse(store.alertsEnabled)
        XCTAssertEqual(store.notified, [])
    }

    func testRefetchReplacesSnapshotOfTheSamePlace() {
        let old = snapshot()
        store.snapshot = old
        let fresh = snapshot(fetchedAt: romeDate("2026-10-22T14:00"))
        XCTAssertTrue(store.replaceSnapshot(with: fresh, basedOn: old))
        XCTAssertEqual(store.snapshot, fresh)
    }

    func testRefetchDoesNotClobberAPlaceChosenMeanwhile() {
        let old = snapshot()
        store.snapshot = old
        let chosen = old.with(place: Place(lat: 36.01, lon: -5.6, name: "Tarifa"))
        store.snapshot = chosen // the app synced another place while the fetch ran
        XCTAssertFalse(store.replaceSnapshot(with: snapshot(fetchedAt: romeDate("2026-10-22T14:00")), basedOn: old))
        XCTAssertEqual(store.snapshot, chosen)
    }

    func testRoundTripsValues() {
        let s = snapshot()
        store.snapshot = s
        store.unit = .kn
        store.alertsEnabled = true
        let window = NotifiedWindow(level: .attenzione, start: romeDate("2026-10-22T10:00"), end: romeDate("2026-10-22T12:00"))
        store.notified = [window]
        XCTAssertEqual(store.snapshot, s)
        XCTAssertEqual(store.unit, .kn)
        XCTAssertTrue(store.alertsEnabled)
        XCTAssertEqual(store.notified, [window])
    }
}
