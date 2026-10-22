import Capacitor
import UserNotifications
import WidgetKit
import WindCore

/// Lets the web app hand its forecast to the widget and turn gust notifications on and off. See src/native.ts.
@objc(VentoPlugin)
public class VentoPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "VentoPlugin"
    public let jsName = "Vento"
    public let pluginMethods: [CAPPluginMethod] = [
        .init(name: "sync", returnType: CAPPluginReturnPromise),
        .init(name: "alertsStatus", returnType: CAPPluginReturnPromise),
        .init(name: "enableAlerts", returnType: CAPPluginReturnPromise),
        .init(name: "disableAlerts", returnType: CAPPluginReturnPromise),
    ]

    private let store = SharedStore()

    override public func load() {
        // Capacitor owns the notification center delegate and routes local notifications here.
        bridge?.notificationRouter.localNotificationHandler = self
    }

    /// A reminder can fire while the app is open: show it anyway, it is a safety warning.
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {}

    private struct SyncPayload: Decodable {
        let place: Place
        let source: PlaceSource
        let unit: SpeedUnit
        let timezone: String
        let current: HourPoint
        let hours: [HourPoint]
        /// Milliseconds since 1970, as Date.now() gives it.
        let fetchedAt: Double
    }

    @objc func sync(_ call: CAPPluginCall) {
        guard let json = try? JSONSerialization.data(withJSONObject: call.options ?? [:]),
              let p = try? JSONDecoder().decode(SyncPayload.self, from: json)
        else {
            call.reject("Invalid forecast payload")
            return
        }
        store.unit = p.unit
        store.snapshot = Snapshot(
            place: p.place,
            source: p.source,
            timezone: p.timezone,
            current: p.current,
            hours: p.hours,
            fetchedAt: Date(timeIntervalSince1970: p.fetchedAt / 1000)
        )
        WidgetCenter.shared.reloadAllTimelines()
        Task {
            // The alert is already on screen: only remember it and set the reminder.
            await AlertScheduler.apply(store, deliverHeadsUp: false)
            call.resolve()
        }
    }

    @objc func alertsStatus(_ call: CAPPluginCall) {
        Task { call.resolve(await status()) }
    }

    @objc func enableAlerts(_ call: CAPPluginCall) {
        Task {
            let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
            store.alertsEnabled = granted
            if granted {
                await AlertScheduler.apply(store, deliverHeadsUp: false)
                BackgroundRefresh.schedule()
            }
            call.resolve(await status())
        }
    }

    @objc func disableAlerts(_ call: CAPPluginCall) {
        store.alertsEnabled = false
        BackgroundRefresh.cancel()
        Task {
            await AlertScheduler.apply(store, deliverHeadsUp: false)
            call.resolve(await status())
        }
    }

    private func status() async -> [String: Any] {
        let permission = switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .authorized, .provisional, .ephemeral: "granted"
        case .denied: "denied"
        default: "prompt"
        }
        return ["permission": permission, "enabled": store.alertsEnabled && permission == "granted"]
    }
}
