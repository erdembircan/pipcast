import AppKit
import StationCore

final class StationDelegate: NSObject, NSApplicationDelegate {
    private let controller: StationController

    init(controller: StationController) {
        self.controller = controller
    }

    // The window is first shown from here, never earlier. A window that is on
    // screen when the app finishes launching makes AppKit activate the app,
    // and that takes the keyboard from whichever app started the station.
    func applicationDidFinishLaunching(_ notification: Notification) {
        controller.start()
    }
}

/// The lock a serving station holds until it ends.
private var heldLock: SingletonLock?

/// `serve`: takes the lock or exits at once (another station serves), then runs the app.
func runServe(_ options: StationOptions) -> Never {
    let normalized = StationOptions(home: absolutePath(options.home), assets: absolutePath(options.assets),
                                    targetBundleID: options.targetBundleID)
    let paths = StorePaths(home: normalized.home)
    do {
        try prepareHome(paths)
    } catch {
        fail("cannot start: \(error.localizedDescription)")
    }
    guard let lock = SingletonLock.tryAcquire(paths.lock) else { exit(0) }
    heldLock = lock

    // SIGTERM keeps its default action: the process ends and the lock goes with it.
    let controller = StationController(options: normalized)

    // At once, so that a launch right after this one finds a station running.
    controller.writeStatus()

    // Before any window is shown: no Dock icon, and never the active app.
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    // NSApplication holds its delegate weakly: this constant keeps it alive.
    let delegate = StationDelegate(controller: controller)
    app.delegate = delegate
    app.run()
    exit(0)
}
