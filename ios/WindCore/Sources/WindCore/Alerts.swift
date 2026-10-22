import Foundation

public let gustWarn = 40.0
public let gustDanger = 60.0

public enum AlertLevel: Int, Codable, Comparable, Sendable {
    case attenzione = 1
    case pericolo = 2

    public static func < (a: AlertLevel, b: AlertLevel) -> Bool { a.rawValue < b.rawValue }
}

/// Same rules as gustAlert in src/alerts.ts.
public struct GustAlert: Equatable, Sendable {
    public let level: AlertLevel
    public let maxGust: Double
    /// First and last hour with gusts at or above `gustWarn`.
    public let start: String
    public let end: String
    /// Strong gusts are blowing right now.
    public let ongoing: Bool
    /// Direction of the peak gust (where it comes from).
    public let dir: Double
}

/// A lull this many hours long or shorter does not end a spell of strong gusts.
let lullHours = 2

/// The first spell of strong gusts: later spells are reported once this one is over.
public func gustAlert(_ hours: [HourPoint]) -> GustAlert? {
    guard let first = hours.firstIndex(where: { $0.gust >= gustWarn }) else { return nil }
    var last = first
    var i = first + 1
    while i < hours.count && i - last <= lullHours + 1 {
        if hours[i].gust >= gustWarn { last = i }
        i += 1
    }
    let spell = hours[first...last]
    let peak = spell.reduce(spell[first]) { $1.gust > $0.gust ? $1 : $0 }
    return GustAlert(
        level: peak.gust >= gustDanger ? .pericolo : .attenzione,
        maxGust: peak.gust,
        start: hours[first].time,
        end: hours[last].time,
        ongoing: first == 0,
        dir: peak.dir
    )
}

/// A gust window the user has already been told about.
public struct NotifiedWindow: Codable, Equatable, Sendable {
    public let level: AlertLevel
    public let start: Date
    public let end: Date

    public init(level: AlertLevel, start: Date, end: Date) {
        self.level = level
        self.start = start
        self.end = end
    }
}

public struct AlertMessage: Equatable, Sendable {
    public let title: String
    public let body: String
}

public struct Reminder: Equatable, Sendable {
    public let date: Date
    public let message: AlertMessage
}

public struct AlertPlan: Equatable, Sendable {
    /// Send now: a new or stronger gust window showed up in the forecast.
    public let headsUp: AlertMessage?
    /// Replaces any pending reminder; nil cancels it.
    public let reminder: Reminder?
    /// Windows announced so far, to store for the next run.
    public let notified: [NotifiedWindow]
}

/**
 Decides which gust notifications to send for the next 24 hours.

 - Parameter deliverHeadsUp: false while the app is open: the alert is already on screen, so the
   window is only remembered.
 */
public func planAlerts(snapshot: Snapshot, now: Date, notified: [NotifiedWindow], unit: SpeedUnit, deliverHeadsUp: Bool) -> AlertPlan {
    var remembered = notified.filter { now.timeIntervalSince($0.end) < 86_400 }
    let clock = snapshot.clock
    guard let alert = gustAlert(snapshot.upcoming(from: now, count: 24)),
          let start = clock.date(alert.start),
          let lastHour = clock.date(alert.end)
    else {
        return AlertPlan(headsUp: nil, reminder: nil, notified: remembered)
    }

    let window = NotifiedWindow(level: alert.level, start: start, end: lastHour.addingTimeInterval(3_600))
    // A window that moved by an hour or two is the same storm: only a new one, or an escalation, is news.
    // The slack matches the lull that gustAlert still counts as one spell.
    let slack = TimeInterval(lullHours) * 3_600
    let known = remembered.contains {
        $0.level >= window.level && $0.start - slack < window.end && window.start < $0.end + slack
    }
    if !known { remembered.append(window) }

    let copy = AlertCopy(alert: alert, place: snapshot.place.name, unit: unit, clock: clock, now: now)
    let fire = start.addingTimeInterval(-3_600)
    return AlertPlan(
        headsUp: !known && deliverHeadsUp ? copy.headsUp : nil,
        reminder: !alert.ongoing && fire > now ? Reminder(date: fire, message: copy.reminder) : nil,
        notified: remembered
    )
}

/// Notification texts, worded like alertCopy in src/format.ts.
struct AlertCopy {
    let alert: GustAlert
    let place: String
    let unit: SpeedUnit
    let clock: LocalClock
    let now: Date

    private func hour(_ iso: String) -> String { String(iso.dropFirst(11).prefix(2)) }

    private var until: String {
        String(format: "%02d", ((Int(hour(alert.end)) ?? 0) + 1) % 24)
    }

    private var peak: String {
        "Fino a \(unit.convert(alert.maxGust)) \(unit.label) da \(windFrom(alert.dir).direction)"
    }

    private var day: String {
        clock.iso(now).prefix(10) == alert.start.prefix(10) ? "oggi" : "domani"
    }

    private var advice: String {
        alert.level == .pericolo
            ? "Ritira tendalino e accessori, evita viadotti e strade esposte. Parcheggia con il muso verso \(windFrom(alert.dir).direction)."
            : "Chiudi il tendalino e fai attenzione alla guida su strade esposte."
    }

    var headsUp: AlertMessage {
        let when = alert.ongoing ? "adesso e fino alle \(until)" : "\(day) dalle \(hour(alert.start)) alle \(until)"
        let title = alert.level == .pericolo ? "Pericolo raffiche a \(place)" : "Raffiche forti a \(place)"
        return AlertMessage(title: title, body: "\(peak), \(when). \(advice)")
    }

    var reminder: AlertMessage {
        AlertMessage(
            title: "Tra un'ora raffiche a \(place)",
            body: "\(peak), dalle \(hour(alert.start)) alle \(until). \(advice)"
        )
    }
}
