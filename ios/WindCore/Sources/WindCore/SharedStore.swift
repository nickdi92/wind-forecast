import Foundation

/// Settings and the last forecast, kept in the App Group so the app, the widget and background
/// refresh all read the same values.
public final class SharedStore {
    public static let appGroup = "group.io.github.nickdi92.vento"

    private let defaults: UserDefaults

    public init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    public convenience init() {
        self.init(defaults: UserDefaults(suiteName: SharedStore.appGroup) ?? .standard)
    }

    private func get<T: Decodable>(_ key: String) -> T? {
        defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(T.self, from: $0) }
    }

    private func set<T: Encodable>(_ value: T?, _ key: String) {
        defaults.set(value.flatMap { try? JSONEncoder().encode($0) }, forKey: key)
    }

    public var snapshot: Snapshot? {
        get { get("snapshot") }
        set { set(newValue, "snapshot") }
    }

    /// Saves a refetched forecast unless the app picked another place while the download ran:
    /// the widget and background refresh work alongside the app.
    @discardableResult
    public func replaceSnapshot(with fresh: Snapshot, basedOn old: Snapshot) -> Bool {
        guard let current = snapshot, current.place == old.place, current.source == old.source else { return false }
        snapshot = fresh
        return true
    }

    public var unit: SpeedUnit {
        get { get("unit") ?? .kmh }
        set { set(newValue, "unit") }
    }

    public var alertsEnabled: Bool {
        get { defaults.bool(forKey: "alertsEnabled") }
        set { defaults.set(newValue, forKey: "alertsEnabled") }
    }

    public var notified: [NotifiedWindow] {
        get { get("notified") ?? [] }
        set { set(newValue, "notified") }
    }
}
