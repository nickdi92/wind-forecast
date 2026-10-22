import Foundation
import UserNotifications
import WindCore

/// Turns an AlertPlan into local notifications.
enum AlertScheduler {
    static let reminderId = "gust-reminder"

    static func apply(_ store: SharedStore, deliverHeadsUp: Bool, now: Date = Date()) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderId])
        guard store.alertsEnabled,
              let snapshot = store.snapshot,
              await center.notificationSettings().authorizationStatus == .authorized
        else { return }

        let plan = planAlerts(snapshot: snapshot, now: now, notified: store.notified, unit: store.unit, deliverHeadsUp: deliverHeadsUp)
        store.notified = plan.notified
        let level = gustAlert(snapshot.upcoming(from: now, count: 24))?.level

        if let message = plan.headsUp {
            try? await center.add(request(id: "gust-\(Int(now.timeIntervalSince1970))", message, level: level, trigger: nil))
        }
        if let reminder = plan.reminder {
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, reminder.date.timeIntervalSince(now)), repeats: false)
            try? await center.add(request(id: reminderId, reminder.message, level: level, trigger: trigger))
        }
    }

    private static func request(id: String, _ message: AlertMessage, level: AlertLevel?, trigger: UNNotificationTrigger?) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = message.title
        content.body = message.body
        content.sound = .default
        content.threadIdentifier = "gusts"
        // Dangerous gusts get through Focus modes: the awning or a high-sided drive can't wait.
        content.interruptionLevel = level == .pericolo ? .timeSensitive : .active
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }
}
