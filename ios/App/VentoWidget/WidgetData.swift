import CoreLocation
import WidgetKit
import WindCore

struct WindEntry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
    let unit: SpeedUnit

    /// The forecast, unless it is too old to pass off as current conditions.
    private var usable: Snapshot? { snapshot.flatMap { $0.isTooOld(at: date) ? nil : $0 } }

    var point: HourPoint? { usable?.point(at: date) }
    var next: [HourPoint] { usable?.upcoming(from: date, count: 12) ?? [] }
    var alert: GustAlert? { usable.flatMap { gustAlert($0.upcoming(from: date, count: 24)) } }

    /// "5 ore fa" once the download is a couple of hours old, so a missed refresh shows.
    var age: String? {
        guard let snapshot else { return nil }
        let hours = Int(date.timeIntervalSince(snapshot.fetchedAt) / 3_600)
        switch hours {
        case ..<2: return nil
        case ..<24: return "\(hours) ore fa"
        default: return "ieri"
        }
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WindEntry {
        WindEntry(date: .now, snapshot: .preview, unit: .kmh)
    }

    func getSnapshot(in context: Context, completion: @escaping (WindEntry) -> Void) {
        let store = SharedStore()
        let snapshot = store.snapshot ?? (context.isPreview ? .preview : nil)
        completion(WindEntry(date: .now, snapshot: snapshot, unit: store.unit))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WindEntry>) -> Void) {
        Task {
            let store = SharedStore()
            let snapshot = await WidgetData.load(store: store)
            let now = Date()
            // One entry per hour from the same download, so the widget moves on even if iOS delays the refresh.
            let calendar = Calendar.current
            let nextHour = calendar.dateInterval(of: .hour, for: now).map(\.end) ?? now
            let dates = [now] + (0..<5).compactMap { calendar.date(byAdding: .hour, value: $0, to: nextHour) }
            let entries = dates.map { WindEntry(date: $0, snapshot: snapshot, unit: store.unit) }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }
}

enum WidgetData {
    /// Forecasts younger than this are reused instead of downloading again.
    static let freshFor: TimeInterval = 25 * 60
    /// Moves shorter than this keep the current place and its name.
    static let movedKm = 3.0

    static func load(store: SharedStore) async -> Snapshot? {
        // Nothing to show until the app has picked a place once.
        guard let last = store.snapshot else { return nil }
        var place = last.place
        var moved = false
        if last.source == .gps, let here = await WidgetLocation.current() {
            let spot = Place(lat: here.coordinate.latitude, lon: here.coordinate.longitude, name: last.place.name)
            if !spot.isNear(last.place, km: movedKm) {
                moved = true
                place = Place(lat: spot.lat, lon: spot.lon, name: await WidgetLocation.name(of: here) ?? "La tua posizione")
            }
        }
        if !moved && Date().timeIntervalSince(last.fetchedAt) < freshFor { return last }
        guard let fresh = try? await OpenMeteo.fetch(place: place, source: last.source) else { return last }
        // The app may have picked another place meanwhile: then show that one.
        return store.replaceSnapshot(with: fresh, basedOn: last) ? fresh : (store.snapshot ?? fresh)
    }
}

/// One-shot location for the widget. Needs the app's "while in use" permission and NSWidgetWantsLocation.
@MainActor
final class WidgetLocation: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    static func current() async -> CLLocation? {
        let helper = WidgetLocation()
        guard helper.manager.isAuthorizedForWidgetUpdates else { return nil }
        return await helper.request()
    }

    static func name(of location: CLLocation) async -> String? {
        let geocoder = CLGeocoder()
        // A slow geocoder must not eat the widget's refresh time: give up and use a generic name.
        let timeout = Task {
            try await Task.sleep(for: .seconds(4))
            geocoder.cancelGeocode()
        }
        defer { timeout.cancel() }
        let placemark = try? await geocoder.reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "it_IT")).first
        return placemark?.locality ?? placemark?.subAdministrativeArea
    }

    private func request() async -> CLLocation? {
        await withCheckedContinuation { c in
            continuation = c
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyKilometer
            manager.requestLocation()
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.finish(nil) }
        }
    }

    private func finish(_ location: CLLocation?) {
        continuation?.resume(returning: location)
        continuation = nil
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let last = locations.last
        Task { @MainActor in finish(last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in finish(nil) }
    }
}

extension Snapshot {
    /// A breezy Maestrale over Olbia with a passing shower, for the widget gallery.
    static var preview: Snapshot {
        let clock = LocalClock(identifier: "Europe/Rome")
        let start = Calendar.current.dateInterval(of: .hour, for: .now)?.start ?? .now
        let speeds: [Double] = [22, 24, 27, 31, 35, 38, 36, 32, 28, 25, 22, 20, 18, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12]
        let hours = speeds.enumerated().map { i, s in
            HourPoint(
                time: clock.iso(start.addingTimeInterval(Double(i) * 3_600)), speed: s, gust: s * 1.45, dir: 310 + Double(i),
                rain: (3...6).contains(i) ? [0.4, 1.8, 2.6, 0.7][i - 3] : 0, rainChance: (2...7).contains(i) ? 60 : 10
            )
        }
        return Snapshot(place: Place(lat: 40.92, lon: 9.5, name: "Olbia"), source: .gps, timezone: "Europe/Rome", current: nil, hours: hours, fetchedAt: .now)
    }
}
