// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "pipcast-station",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "pipcast-station", targets: ["PipcastStation"]),
    ],
    targets: [
        // Everything that can be tested without a window: Foundation and CoreGraphics only.
        .target(name: "StationCore"),
        // The app: the window, its controls, the web view and the sound.
        .executableTarget(name: "PipcastStation", dependencies: ["StationCore"]),
        // The checks' witness: asks the window server where a running station is. Not shipped.
        .executableTarget(name: "station-inspect", dependencies: ["StationCore"]),
        .testTarget(name: "StationCoreTests", dependencies: ["StationCore"]),
    ]
)
