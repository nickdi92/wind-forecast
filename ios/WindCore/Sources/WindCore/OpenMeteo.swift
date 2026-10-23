import Foundation

/// Same request as fetchForecast in src/api.ts, minus the daily summary the widget does not show.
public enum OpenMeteo {
    private static let vars = "wind_speed_10m,wind_gusts_10m,wind_direction_10m"
    private static let rainVars = "precipitation,precipitation_probability"

    public static func forecastURL(lat: Double, lon: Double) -> URL {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            URLQueryItem(name: "latitude", value: String(format: "%.4f", lat)),
            URLQueryItem(name: "longitude", value: String(format: "%.4f", lon)),
            URLQueryItem(name: "current", value: vars),
            URLQueryItem(name: "hourly", value: "\(vars),\(rainVars)"),
            URLQueryItem(name: "timezone", value: "auto"),
            URLQueryItem(name: "forecast_days", value: "3"),
            URLQueryItem(name: "wind_speed_unit", value: "kmh"),
        ]
        return c.url!
    }

    private struct Response: Decodable {
        struct Current: Decodable {
            let time: String
            let wind_speed_10m: Double
            let wind_gusts_10m: Double
            let wind_direction_10m: Double
        }

        struct Hourly: Decodable {
            let time: [String]
            let wind_speed_10m: [Double?]
            let wind_gusts_10m: [Double?]
            let wind_direction_10m: [Double?]
            let precipitation: [Double?]?
            let precipitation_probability: [Double?]?
        }

        let timezone: String
        let current: Current?
        let hourly: Hourly
    }

    public static func decode(_ data: Data, place: Place, source: PlaceSource, fetchedAt: Date) throws -> Snapshot {
        let r = try JSONDecoder().decode(Response.self, from: data)
        let h = r.hourly
        // Rain is stamped at the end of the hour it fell in: shift it back one hour, like hourPoints in src/forecast.ts.
        func rainAfter(_ values: [Double?]?, _ i: Int) -> Double {
            guard let values, i + 1 < values.count else { return 0 }
            return values[i + 1] ?? 0
        }
        let hours = h.time.indices.compactMap { i -> HourPoint? in
            guard let speed = h.wind_speed_10m[i], let gust = h.wind_gusts_10m[i], let dir = h.wind_direction_10m[i] else { return nil }
            return HourPoint(
                time: h.time[i], speed: speed, gust: gust, dir: dir,
                rain: rainAfter(h.precipitation, i), rainChance: rainAfter(h.precipitation_probability, i)
            )
        }
        let current = r.current.map { HourPoint(time: $0.time, speed: $0.wind_speed_10m, gust: $0.wind_gusts_10m, dir: $0.wind_direction_10m) }
        return Snapshot(place: place, source: source, timezone: r.timezone, current: current, hours: hours, fetchedAt: fetchedAt)
    }

    public static func fetch(place: Place, source: PlaceSource, session: URLSession = .shared) async throws -> Snapshot {
        var request = URLRequest(url: forecastURL(lat: place.lat, lon: place.lon))
        request.timeoutInterval = 12
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try decode(data, place: place, source: source, fetchedAt: Date())
    }
}
