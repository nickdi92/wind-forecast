import XCTest
@testable import WindCore

final class ForecastTests: XCTestCase {
    func testLocalClockRoundTripsWallClockTime() {
        let clock = LocalClock(timeZone: rome)
        let date = clock.date("2026-10-22T13:40")!
        XCTAssertEqual(clock.iso(date), "2026-10-22T13:40")
        // 13:40 in Rome (CEST, UTC+2) is 11:40 UTC.
        XCTAssertEqual(LocalClock(timeZone: TimeZone(identifier: "UTC")!).iso(date), "2026-10-22T11:40")
    }

    func testUnknownTimezoneFallsBackWithoutCrashing() {
        XCTAssertNotNil(LocalClock(identifier: "Not/AZone").date("2026-10-22T13:00"))
    }

    func testUpcomingStartsAtCurrentLocalHour() {
        let s = snapshot()
        let next = s.upcoming(from: romeDate("2026-10-22T13:40"), count: 24)
        XCTAssertEqual(next.count, 24)
        XCTAssertEqual(next.first?.time, "2026-10-22T13:00")
        XCTAssertEqual(next.last?.time, "2026-10-23T12:00")
    }

    func testUpcomingIsEmptyWhenDataEndedBeforeNow() {
        XCTAssertTrue(snapshot().upcoming(from: romeDate("2026-10-25T10:00"), count: 24).isEmpty)
    }

    func testPointPrefersLiveReadingWithinItsHour() {
        let live = HourPoint(time: "2026-10-22T13:15", speed: 31, gust: 44, dir: 300)
        let s = snapshot(current: live)
        XCTAssertEqual(s.point(at: romeDate("2026-10-22T13:50")), live)
        XCTAssertEqual(s.point(at: romeDate("2026-10-22T14:10"))?.time, "2026-10-22T14:00")
    }

    func testLiveReadingTakesRainFromTheForecastForItsHour() {
        let live = HourPoint(time: "2026-10-22T13:15", speed: 31, gust: 44, dir: 300)
        let base = snapshot(current: live)
        var hours = base.hours
        hours[13] = HourPoint(time: "2026-10-22T13:00", speed: 20, gust: 30, dir: 310, rain: 0.8, rainChance: 70)
        let s = Snapshot(place: base.place, source: base.source, timezone: base.timezone, current: live, hours: hours, fetchedAt: base.fetchedAt)
        XCTAssertEqual(
            s.point(at: romeDate("2026-10-22T13:50")),
            HourPoint(time: "2026-10-22T13:15", speed: 31, gust: 44, dir: 300, rain: 0.8, rainChance: 70)
        )
    }

    func testPointSavedBeforeRainWasAddedDecodesAsDry() throws {
        let json = #"{"time":"2026-10-22T13:00","speed":12,"gust":20,"dir":300}"#
        let p = try JSONDecoder().decode(HourPoint.self, from: Data(json.utf8))
        XCTAssertEqual(p, HourPoint(time: "2026-10-22T13:00", speed: 12, gust: 20, dir: 300, rain: 0, rainChance: 0))
    }

    func testForecastOlderThanTwoDaysIsTooOldToShowAsNow() {
        let s = snapshot(fetchedAt: romeDate("2026-10-22T13:00"))
        XCTAssertFalse(s.isTooOld(at: romeDate("2026-10-24T12:59")))
        XCTAssertTrue(s.isTooOld(at: romeDate("2026-10-24T13:01")))
    }

    func testPlacesWithinTwoKilometresAreNear() {
        let olbia = Place(lat: 40.92, lon: 9.5, name: "Olbia")
        XCTAssertTrue(olbia.isNear(Place(lat: 40.93, lon: 9.51, name: ""), km: 2))
        XCTAssertFalse(olbia.isNear(Place(lat: 41.0, lon: 9.5, name: ""), km: 2))
    }

    func testDecodesOpenMeteoResponse() throws {
        let json = """
        {"timezone":"Europe/Rome",
         "current":{"time":"2026-10-22T13:15","wind_speed_10m":12.4,"wind_gusts_10m":25.1,"wind_direction_10m":310},
         "hourly":{"time":["2026-10-22T13:00","2026-10-22T14:00"],
                   "wind_speed_10m":[12.0,14.0],"wind_gusts_10m":[24.0,30.0],"wind_direction_10m":[305,320]}}
        """
        let place = Place(lat: 40.92, lon: 9.5, name: "Olbia")
        let fetched = Date(timeIntervalSince1970: 1_000)
        let s = try OpenMeteo.decode(Data(json.utf8), place: place, source: .search, fetchedAt: fetched)
        XCTAssertEqual(s.timezone, "Europe/Rome")
        XCTAssertEqual(s.current, HourPoint(time: "2026-10-22T13:15", speed: 12.4, gust: 25.1, dir: 310))
        XCTAssertEqual(s.hours[1], HourPoint(time: "2026-10-22T14:00", speed: 14, gust: 30, dir: 320))
        XCTAssertEqual(s.source, .search)
        XCTAssertEqual(s.fetchedAt, fetched)
    }

    func testDecodesRainForTheHourItFallsIn() throws {
        // Open-Meteo stamps rain at the end of the hour: 0.8 mm fell between 13 and 14.
        let json = """
        {"timezone":"Europe/Rome",
         "hourly":{"time":["2026-10-22T13:00","2026-10-22T14:00","2026-10-22T15:00"],
                   "wind_speed_10m":[12.0,14.0,15.0],"wind_gusts_10m":[24.0,30.0,31.0],"wind_direction_10m":[305,320,320],
                   "precipitation":[0.0,0.8,0.0],"precipitation_probability":[10,70,null]}}
        """
        let s = try OpenMeteo.decode(Data(json.utf8), place: Place(lat: 40.92, lon: 9.5, name: "Olbia"), source: .gps, fetchedAt: Date())
        XCTAssertEqual(s.hours.map(\.rain), [0.8, 0, 0])
        XCTAssertEqual(s.hours.map(\.rainChance), [70, 0, 0])
    }

    func testForecastURLAsksForWindInKmhAndHourlyRain() {
        let url = OpenMeteo.forecastURL(lat: 40.9234567, lon: 9.5)
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        let q = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value!) })
        XCTAssertEqual(q["latitude"], "40.9235")
        XCTAssertEqual(q["wind_speed_unit"], "kmh")
        XCTAssertEqual(q["timezone"], "auto")
        XCTAssertEqual(q["current"], "wind_speed_10m,wind_gusts_10m,wind_direction_10m")
        XCTAssertEqual(q["hourly"], "wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability")
    }
}
