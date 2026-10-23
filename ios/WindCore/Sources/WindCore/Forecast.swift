import Foundation

public struct HourPoint: Codable, Equatable, Sendable {
    /// Wall-clock time at the place, as Open-Meteo sends it: "2026-10-22T17:00".
    public let time: String
    public let speed: Double
    public let gust: Double
    public let dir: Double
    /// mm expected from `time` to the next hour.
    public let rain: Double
    /// % chance of rain in the same hour.
    public let rainChance: Double

    public init(time: String, speed: Double, gust: Double, dir: Double, rain: Double = 0, rainChance: Double = 0) {
        self.time = time
        self.speed = speed
        self.gust = gust
        self.dir = dir
        self.rain = rain
        self.rainChance = rainChance
    }

    /// Snapshots saved, and payloads sent by the web app, before rain was added read as dry.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        time = try c.decode(String.self, forKey: .time)
        speed = try c.decode(Double.self, forKey: .speed)
        gust = try c.decode(Double.self, forKey: .gust)
        dir = try c.decode(Double.self, forKey: .dir)
        rain = try c.decodeIfPresent(Double.self, forKey: .rain) ?? 0
        rainChance = try c.decodeIfPresent(Double.self, forKey: .rainChance) ?? 0
    }

    func with(rainOf other: HourPoint) -> HourPoint {
        HourPoint(time: time, speed: speed, gust: gust, dir: dir, rain: other.rain, rainChance: other.rainChance)
    }
}

public enum PlaceSource: String, Codable, Sendable {
    case gps, search, link
}

public struct Place: Codable, Equatable, Sendable {
    public let lat: Double
    public let lon: Double
    public let name: String

    public init(lat: Double, lon: Double, name: String) {
        self.lat = lat
        self.lon = lon
        self.name = name
    }

    /// Equirectangular distance: plenty for "did the camper move".
    public func isNear(_ other: Place, km: Double) -> Bool {
        let rad = Double.pi / 180
        let x = (other.lon - lon) * rad * cos((lat + other.lat) / 2 * rad)
        let y = (other.lat - lat) * rad
        return (x * x + y * y).squareRoot() * 6371 <= km
    }
}

/// Converts between instants and wall-clock strings in the place's timezone.
public struct LocalClock: Sendable {
    public let timeZone: TimeZone

    public init(timeZone: TimeZone) {
        self.timeZone = timeZone
    }

    public init(identifier: String) {
        self.init(timeZone: TimeZone(identifier: identifier) ?? .current)
    }

    private var formatter: DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = timeZone
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }

    public func iso(_ date: Date) -> String {
        formatter.string(from: date)
    }

    public func date(_ iso: String) -> Date? {
        formatter.date(from: String(iso.prefix(16)))
    }
}

/// The last forecast for one place, shared between app, widget and background refresh.
public struct Snapshot: Codable, Equatable, Sendable {
    public let place: Place
    public let source: PlaceSource
    public let timezone: String
    /// Open-Meteo's 15-minute reading, more accurate than the hourly value for its own hour.
    public let current: HourPoint?
    public let hours: [HourPoint]
    public let fetchedAt: Date

    public init(place: Place, source: PlaceSource, timezone: String, current: HourPoint?, hours: [HourPoint], fetchedAt: Date) {
        self.place = place
        self.source = source
        self.timezone = timezone
        self.current = current
        self.hours = hours
        self.fetchedAt = fetchedAt
    }

    public var clock: LocalClock { LocalClock(identifier: timezone) }

    /// Past this age the widget asks to open the app instead of showing an old forecast as "now".
    public static let maxAge: TimeInterval = 48 * 3_600

    public func isTooOld(at date: Date) -> Bool {
        date.timeIntervalSince(fetchedAt) > Snapshot.maxAge
    }

    /// Hourly points from the hour containing `now`, re-anchored like buildForecast in src/forecast.ts.
    public func upcoming(from now: Date, count: Int) -> [HourPoint] {
        let hour = clock.iso(now).prefix(13) + ":00"
        guard let start = hours.firstIndex(where: { $0.time >= hour }), hours[start].time.prefix(13) == hour.prefix(13) else {
            return []
        }
        return Array(hours[start..<min(hours.count, start + count)])
    }

    public func point(at date: Date) -> HourPoint? {
        let hour = upcoming(from: date, count: 1).first
        // The live reading carries no rain: take the forecast for its hour.
        if let current, current.time.prefix(13) == clock.iso(date).prefix(13) { return hour.map(current.with(rainOf:)) ?? current }
        return hour
    }

    public func with(place: Place) -> Snapshot {
        Snapshot(place: place, source: source, timezone: timezone, current: current, hours: hours, fetchedAt: fetchedAt)
    }
}
