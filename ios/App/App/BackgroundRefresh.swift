import BackgroundTasks
import Foundation
import WidgetKit
import WindCore

/// Refetches the forecast while the app is closed so gust warnings arrive without opening it.
/// iOS decides when this actually runs, usually every hour or so for an app used daily.
enum BackgroundRefresh {
    static let taskId = "io.github.nickdi92.vento.refresh"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            handle(task)
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func cancel() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId)
    }

    private static func handle(_ task: BGAppRefreshTask) {
        if SharedStore().alertsEnabled { schedule() }
        let work = Task {
            await refresh()
            task.setTaskCompleted(success: !Task.isCancelled)
        }
        task.expirationHandler = { work.cancel() }
    }

    static func refresh() async {
        let store = SharedStore()
        guard store.alertsEnabled, let last = store.snapshot else { return }
        if let fresh = try? await OpenMeteo.fetch(place: last.place, source: last.source),
           store.replaceSnapshot(with: fresh, basedOn: last) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        await AlertScheduler.apply(store, deliverHeadsUp: true)
    }
}
