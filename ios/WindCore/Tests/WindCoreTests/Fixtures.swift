import Foundation
@testable import WindCore

let rome = TimeZone(identifier: "Europe/Rome")!

/** An instant given as wall-clock time in Rome, e.g. "2026-10-22T13:40". */
func romeDate(_ iso: String) -> Date {
    LocalClock(timeZone: rome).date(iso)!
}

/** 48 hourly points from 2026-10-22T00:00 Rome; gust comes from the closure, speed is gust * 0.6. */
func snapshot(
    gust: (Int) -> Double = { _ in 20 },
    dir: Double = 315,
    current: HourPoint? = nil,
    fetchedAt: Date = romeDate("2026-10-22T13:05")
) -> Snapshot {
    let hours = (0..<48).map { i -> HourPoint in
        let day = 22 + i / 24
        let time = String(format: "2026-10-%02dT%02d:00", day, i % 24)
        return HourPoint(time: time, speed: gust(i) * 0.6, gust: gust(i), dir: dir)
    }
    return Snapshot(
        place: Place(lat: 40.92, lon: 9.5, name: "Olbia"),
        source: .gps,
        timezone: "Europe/Rome",
        current: current,
        hours: hours,
        fetchedAt: fetchedAt
    )
}
