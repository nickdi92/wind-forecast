// swift-tools-version: 5.9
import PackageDescription

// Wind logic shared by the app and the widget. Mirrors src/wind.ts, src/alerts.ts and src/forecast.ts.
let package = Package(
    name: "WindCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "WindCore", targets: ["WindCore"])
    ],
    targets: [
        .target(name: "WindCore"),
        .testTarget(name: "WindCoreTests", dependencies: ["WindCore"])
    ]
)
