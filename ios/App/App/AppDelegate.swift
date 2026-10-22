import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Must happen before launch finishes, or iOS drops the background refresh task.
        BackgroundRefresh.register()
        #if DEBUG
        // Try gust notifications without waiting for iOS:
        // xcrun simctl launch booted io.github.nickdi92.vento -VentoRunBackgroundRefresh
        if ProcessInfo.processInfo.arguments.contains("-VentoRunBackgroundRefresh") {
            Task { await BackgroundRefresh.refresh() }
        }
        #endif
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
