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
        // The sound: the jingles and the beat, mixed as the page's events come. AVFoundation; its checks render it offline.
        .target(name: "StationSound", dependencies: ["StationCore"]),
        // The app: the window, its controls and the web view.
        .executableTarget(name: "PipcastStation", dependencies: ["StationCore", "StationSound"]),
        // The checks' witness: asks the window server where a running station is. Not shipped.
        .executableTarget(name: "station-inspect", dependencies: ["StationCore"]),
        .testTarget(name: "StationCoreTests", dependencies: ["StationCore"]),
        .testTarget(name: "StationSoundTests", dependencies: ["StationSound", "StationCore"]),
    ]
)
