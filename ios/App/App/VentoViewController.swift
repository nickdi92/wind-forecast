import Capacitor

/// Bridge controller that registers the app's own plugin, which lives in this target rather than in a package.
class VentoViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VentoPlugin())
    }
}
