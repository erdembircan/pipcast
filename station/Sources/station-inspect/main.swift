import AppKit
import StationCore

// The checks' witness: asks the window server where a running station is and
// whether it ever took the keyboard. Not shipped.

let usage = """
usage: station-inspect window <pid>
       station-inspect expect <pid> shown <top-left|top-right|bottom-left|bottom-right> <scale>
       station-inspect expect <pid> hidden
       station-inspect frontmost
       station-inspect locked
"""

let stationLevel = Int(CGWindowLevelForKey(.statusWindow))

struct Window {
    let pid: Int32
    let owner: String
    let layer: Int
    let onScreen: Bool
    /// AppKit coordinates: origin at the bottom left of the primary screen, y up.
    let appKit: CGRect
}

/// The primary screen's height, which turns the window server's coordinates
/// (origin top left, y down) into AppKit's (technical reference 4.6).
func primaryHeight() -> CGFloat {
    NSScreen.screens.first?.frame.height ?? 0
}

/// Every window the window server lists, front to back, on screen or not.
func windows(options: CGWindowListOption) -> [Window] {
    let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
    return list.compactMap { entry in
        guard let layer = entry[kCGWindowLayer as String] as? Int,
              let boundsDictionary = entry[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: boundsDictionary as CFDictionary) else { return nil }
        let appKit = CGRect(x: bounds.minX, y: primaryHeight() - bounds.minY - bounds.height,
                            width: bounds.width, height: bounds.height)
        return Window(pid: entry[kCGWindowOwnerPID as String] as? Int32 ?? -1,
                      owner: entry[kCGWindowOwnerName as String] as? String ?? "?",
                      layer: layer,
                      onScreen: entry[kCGWindowIsOnscreen as String] as? Bool ?? false,
                      appKit: appKit)
    }
}

func stationWindows(_ pid: Int32, options: CGWindowListOption = [.optionOnScreenOnly]) -> [Window] {
    windows(options: options).filter { $0.pid == pid && $0.layer == stationLevel }
}

func isRunning(_ pid: Int32) -> Bool { kill(pid, 0) == 0 }

/// A locked session has no visible windows to a web view, and the frontmost app is the login window.
func isScreenLocked() -> Bool {
    let session = CGSessionCopyCurrentDictionary() as? [String: Any]
    return (session?["CGSSessionScreenIsLocked"] as? Bool) == true
}

func usageError() -> Never {
    FileHandle.standardError.write(Data("\(usage)\n".utf8))
    exit(64)
}

func pass(_ line: String) -> Never {
    print(line)
    exit(0)
}

func fail(_ line: String) -> Never {
    print(line)
    exit(1)
}

func describe(_ frame: CGRect) -> String {
    "\(Int(frame.width.rounded()))x\(Int(frame.height.rounded())) at \(Int(frame.minX.rounded())),\(Int(frame.minY.rounded()))"
}

func number(_ value: CGFloat) -> String {
    let rounded = (Double(value) * 100).rounded() / 100
    return rounded == rounded.rounded() ? String(Int(rounded)) : String(rounded)
}

/// Waits while letting notifications arrive.
func pause(_ seconds: Double) {
    RunLoop.current.run(until: Date().addingTimeInterval(seconds))
}

/// Notes every time the station becomes the frontmost app, however briefly.
final class ActivationWatch {
    private(set) var stationWasFrontmost = false

    init(pid: Int32) {
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { [self] notification in
            let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            if app?.processIdentifier == pid { stationWasFrontmost = true }
        }
    }

    func check(_ pid: Int32) -> Bool {
        stationWasFrontmost || NSWorkspace.shared.frontmostApplication?.processIdentifier == pid
    }
}

let arguments = Array(CommandLine.arguments.dropFirst())

switch arguments.first {
case "frontmost" where arguments.count == 1:
    let app = NSWorkspace.shared.frontmostApplication
    pass("\(app?.bundleIdentifier ?? "none") \(app?.processIdentifier ?? 0)")

case "locked" where arguments.count == 1:
    pass(isScreenLocked() ? "locked" : "unlocked")

case "window" where arguments.count == 2:
    guard let pid = Int32(arguments[1]) else { usageError() }
    let all = stationWindows(pid, options: [.optionAll])
    guard let window = all.first(where: \.onScreen) ?? all.first else { pass("{}") }
    pass("{\"onScreen\":\(window.onScreen),\"layer\":\(window.layer),\"x\":\(number(window.appKit.minX)),"
        + "\"y\":\(number(window.appKit.minY)),\"width\":\(number(window.appKit.width)),\"height\":\(number(window.appKit.height))}")

case "expect" where arguments.count == 3 && arguments[2] == "hidden":
    guard let pid = Int32(arguments[1]) else { usageError() }
    let watch = ActivationWatch(pid: pid)
    for _ in 0..<60 {
        if watch.check(pid) { fail("FAIL the station is the frontmost app") }
        if stationWindows(pid).isEmpty {
            guard isRunning(pid) else { fail("FAIL the station (pid \(pid)) is not running") }
            // Hold for a moment: the window must stay away, not just not have appeared yet.
            for _ in 0..<8 {
                pause(0.05)
                if watch.check(pid) { fail("FAIL the station is the frontmost app") }
                if let found = stationWindows(pid).first { fail("FAIL expected no window on screen, found one at \(describe(found.appKit))") }
            }
            pass("ok   hidden: the station is running and has no window on screen")
        }
        pause(0.05)
    }
    if let found = stationWindows(pid).first { fail("FAIL expected no window on screen, found one at \(describe(found.appKit))") }
    fail("FAIL expected no window on screen")

case "expect" where arguments.count == 5 && arguments[2] == "shown":
    guard let pid = Int32(arguments[1]), let quadrant = Quadrant(rawValue: arguments[3]),
          let scale = Double(arguments[4]) else { usageError() }
    let screen = NSScreen.main ?? NSScreen.screens[0]
    let expected = Geometry.frame(quadrant: quadrant, scale: CGFloat(scale), visible: screen.visibleFrame)
    func close(_ a: CGFloat, _ b: CGFloat) -> Bool { abs(a - b) <= 1 }

    // On a locked screen the window server holds the show animation's first
    // frame, a little smaller than the real one around the same centre. Then
    // the centre and the size are checked within 5% instead of the exact frame.
    let locked = isScreenLocked()
    func matches(_ frame: CGRect) -> Bool {
        if !locked {
            return close(frame.minX, expected.minX) && close(frame.minY, expected.minY)
                && close(frame.width, expected.width) && close(frame.height, expected.height)
        }
        func size(_ value: CGFloat, _ target: CGFloat) -> Bool {
            value >= target * 0.95 && value <= target + 1
        }
        return close(frame.midX, expected.midX) && close(frame.midY, expected.midY)
            && size(frame.width, expected.width) && size(frame.height, expected.height)
    }

    let watch = ActivationWatch(pid: pid)
    var seen: [Window] = []
    for _ in 0..<60 {
        if watch.check(pid) {
            fail("FAIL the station became the frontmost app")
        }
        let own = stationWindows(pid)
        seen = own
        if own.count == 1, let window = own.first, matches(window.appKit) {
            // Activation, when it happens, lands a moment after the window appears.
            pause(0.4)
            let frontmost = NSWorkspace.shared.frontmostApplication
            if watch.check(pid) {
                fail("FAIL the window is in the \(quadrant.rawValue) place, but the station took focus: it was the frontmost app")
            }
            let front = frontmost?.bundleIdentifier ?? "unknown"
            if locked {
                pass("ok   shown in the \(quadrant.rawValue) place at \(describe(window.appKit)) (screen locked: the window server holds the show animation's first frame, so its centre and size were checked within 5%); frontmost app: \(front)")
            }
            pass("ok   shown in the \(quadrant.rawValue) place at \(describe(window.appKit)); frontmost app: \(front)")
        }
        pause(0.05)
    }
    guard isRunning(pid) else { fail("FAIL the station (pid \(pid)) is not running") }
    let found = seen.isEmpty ? "no window on screen" : seen.map { describe($0.appKit) }.joined(separator: "; ")
    fail("FAIL expected the window at \(describe(expected)); found: \(found)")

default:
    usageError()
}
