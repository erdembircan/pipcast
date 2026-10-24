import AppKit
import StationCore

// The checks' witness: asks the window server where a running station is,
// which Spaces its window is on, how soon it leaves the screen, and whether it
// ever took the keyboard. Not shipped.

let usage = """
usage: station-inspect window <pid>
       station-inspect expect <pid> shown <top-left|top-right|bottom-left|bottom-right> <scale>
       station-inspect expect <pid> minimized <top-left|top-right|bottom-left|bottom-right> <scale>
       station-inspect expect <pid> hidden
       station-inspect expect <pid> gone-within <ms> <station.log>
       station-inspect expect <pid> alpha <on|off>
       station-inspect spaces <pid> <bundle id>
       station-inspect frontmost
       station-inspect locked
"""

let stationLevel = Int(CGWindowLevelForKey(.statusWindow))

struct Window {
    let pid: Int32
    let number: CGWindowID
    let owner: String
    let layer: Int
    let onScreen: Bool
    let alpha: Double
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
                      number: entry[kCGWindowNumber as String] as? CGWindowID ?? 0,
                      owner: entry[kCGWindowOwnerName as String] as? String ?? "?",
                      layer: layer,
                      onScreen: entry[kCGWindowIsOnscreen as String] as? Bool ?? false,
                      alpha: entry[kCGWindowAlpha as String] as? Double ?? 1,
                      appKit: appKit)
    }
}

func stationWindows(_ pid: Int32, options: CGWindowListOption = [.optionOnScreenOnly]) -> [Window] {
    windows(options: options).filter { $0.pid == pid && $0.layer == stationLevel }
}

/// The station's windows that are the window itself: wider than 100 pt. The handle's panel is narrower, and is on
/// screen during a hover.
func mainWindows(_ pid: Int32) -> [Window] {
    stationWindows(pid).filter { $0.appKit.width > 100 }
}

/// The station's other windows: the handle on the window, or the tab at the screen's edge.
func tabWindows(_ pid: Int32) -> [Window] {
    stationWindows(pid).filter { $0.appKit.width <= 100 }
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

/// Space ids for a line, or "none".
func spaceList(_ ids: [UInt64]) -> String {
    ids.isEmpty ? "none" : ids.map(String.init).joined(separator: ", ")
}

/// A station log's lines, or none when it cannot be read.
func logLines(_ path: String) -> [String] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { return [] }
    return text.split(separator: "\n").map(String.init)
}

/// When the first of these log lines that says `hidden` was written.
func hiddenTime(in lines: ArraySlice<String>) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    for line in lines where line.hasSuffix(" hidden") {
        guard let stamp = line.split(separator: " ").first else { continue }
        if let date = formatter.date(from: String(stamp)) { return date }
    }
    return nil
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
        let own = mainWindows(pid)
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

case "expect" where arguments.count == 5 && arguments[2] == "minimized":
    guard let pid = Int32(arguments[1]), let quadrant = Quadrant(rawValue: arguments[3]),
          let scale = Double(arguments[4]) else { usageError() }
    let screen = NSScreen.main ?? NSScreen.screens[0]
    let visible = screen.visibleFrame
    let rest = Geometry.frame(quadrant: quadrant, scale: CGFloat(scale), visible: visible)
    let expected = Minimize.tab(rest: rest, visible: visible, side: quadrant.side)
    func close(_ a: CGFloat, _ b: CGFloat) -> Bool { abs(a - b) <= 1 }
    func isTheTab(_ frame: CGRect) -> Bool {
        let edge = quadrant.isRight ? close(frame.maxX, visible.maxX) : close(frame.minX, visible.minX)
        return close(frame.width, Minimize.handleSize.width) && close(frame.height, Minimize.handleSize.height)
            && edge && close(frame.midY, rest.midY)
    }

    // The window is gone from the screen and one small panel, the tab, sits against the side.
    var seen = "no window on screen"
    for _ in 0..<60 {
        let main = mainWindows(pid)
        let tabs = tabWindows(pid)
        if main.isEmpty, tabs.count == 1, let tab = tabs.first, isTheTab(tab.appKit) {
            pass("ok   minimized to the \(quadrant.side.rawValue) edge: the tab at \(describe(tab.appKit))")
        }
        let found = (main + tabs).map { describe($0.appKit) }
        seen = found.isEmpty ? "no window on screen" : found.joined(separator: "; ")
        pause(0.05)
    }
    guard isRunning(pid) else { fail("FAIL the station (pid \(pid)) is not running") }
    fail("FAIL expected the tab at \(describe(expected)); found: \(seen)")

case "spaces" where arguments.count == 3:
    guard let pid = Int32(arguments[1]) else { usageError() }
    let target = arguments[2]
    guard let spaces = WindowServerSpaces() else { fail("FAIL cannot read the window server's Spaces on this macOS") }
    guard let window = stationWindows(pid, options: [.optionAll]).first else { fail("FAIL the station (pid \(pid)) has no window") }
    let pids = NSRunningApplication.runningApplications(withBundleIdentifier: target).map { Int($0.processIdentifier) }
    let own = Spaces.ownFullScreen(in: spaces.displays(), pids: Set(pids))
    let on = spaces.spaces(of: window.number)
    let both = on.filter(own.contains)
    let detail = "the window is on \(spaceList(on)); \(target)'s own full-screen Spaces: \(spaceList(own)); you are on \(spaces.active())"
    if !both.isEmpty { fail("FAIL the window is on \(target)'s own full-screen Space \(spaceList(both)): \(detail)") }
    pass("ok   the window is off \(target)'s own full-screen Spaces: \(detail)")

case "expect" where arguments.count == 4 && arguments[2] == "alpha":
    guard let pid = Int32(arguments[1]), ["on", "off"].contains(arguments[3]) else { usageError() }
    let setting = arguments[3]
    func percent(_ alpha: Double) -> String { "\(Int((alpha * 100).rounded()))%" }
    // The station reads options.json every second and fades over 0.25 s. Nothing here moves the pointer: the
    // opacity expected follows wherever it happens to be.
    var seen = "no window on screen"
    for _ in 0..<60 {
        if let window = mainWindows(pid).first {
            let pointerOn = window.appKit.contains(NSEvent.mouseLocation)
            let expected = windowAlpha(transparent: setting == "on", hovered: pointerOn)
            let place = pointerOn ? "the pointer on it" : "the pointer elsewhere"
            if abs(window.alpha - expected) < 0.01 {
                pass("ok   Transparent window \(setting): the window server shows the window at \(percent(window.alpha)) with \(place)")
            }
            seen = "\(percent(window.alpha)) with \(place), where \(percent(expected)) was expected"
        }
        pause(0.05)
    }
    guard isRunning(pid) else { fail("FAIL the station (pid \(pid)) is not running") }
    fail("FAIL Transparent window \(setting): the window server shows the window at \(seen)")

case "expect" where arguments.count == 5 && arguments[2] == "gone-within":
    guard let pid = Int32(arguments[1]), let limit = Double(arguments[3]) else { usageError() }
    let path = arguments[4]
    let watch = ActivationWatch(pid: pid)
    let skip = logLines(path).count
    var seen = false
    var goneAt: Date?
    var hiddenAt: Date?
    let deadline = Date().addingTimeInterval(10)
    while Date() < deadline {
        if watch.check(pid) { fail("FAIL the station is the frontmost app") }
        if stationWindows(pid).isEmpty {
            if seen && goneAt == nil { goneAt = Date() }
        } else {
            seen = true
        }
        if hiddenAt == nil { hiddenAt = hiddenTime(in: logLines(path).dropFirst(skip)) }
        if let goneAt, let hiddenAt {
            let ms = (goneAt.timeIntervalSince(hiddenAt) * 1000).rounded()
            if ms > limit {
                fail("FAIL the window left the screen \(Int(ms)) ms after the station hid it; the limit is \(Int(limit)) ms")
            }
            pass("ok   the window left the screen within \(Int(max(0, ms))) ms of the station hiding it")
        }
        pause(0.005)
    }
    if !seen { fail("FAIL the window was never on screen") }
    if hiddenAt == nil { fail("FAIL the station never hid its window") }
    fail("FAIL the window stayed on screen")

default:
    usageError()
}
