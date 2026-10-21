import AppKit
import StationCore
import WebKit

func nowMilliseconds() -> Double {
    (Date().timeIntervalSince1970 * 1000).rounded()
}

/// Owns the window, the store reading and the bridge for as long as the
/// station serves.
final class StationController: NSObject, InteractionDelegate, WKNavigationDelegate {
    private let options: StationOptions
    private let paths: StorePaths
    private let log: StationLog
    private var prefs: StationPrefs
    private let startedAt = Date()
    private let startedAtMs = nowMilliseconds()

    private let panel = StationPanel()
    private let bridge = PageBridge()
    private let web: StationWebView
    private let chrome: ChromeView
    private var jingles: Jingles?

    private(set) var quadrant: Quadrant
    private var frontmostID: String?
    private var isShown: Bool?
    private var onAirRecords: [RecordFile] = []
    private var everOnAir = false
    private var emptySince: Date?
    private var pageReady = false
    private var lastSendError: String?
    private var watcher: DispatchSourceFileSystemObject?
    private var timers: [Timer] = []

    init(options: StationOptions) {
        self.options = options
        paths = StorePaths(home: options.home)
        log = StationLog(path: paths.log)
        prefs = StationPrefs.load(from: paths.prefs)
        quadrant = prefs.quadrant
        web = makeStationWebView(bridge: bridge)
        chrome = ChromeView(web: web)
        super.init()

        web.navigationDelegate = self
        panel.contentView = chrome
        chrome.interaction.delegate = self
        chrome.close.onPress = { [weak self] in self?.close() }
        chrome.sound.onPress = { [weak self] in self?.toggleSound() }
        chrome.back.onPress = { [weak self] in self?.backToClaude() }
        bridge.onMessage = { [weak self] message in self?.receive(message) }
        showSoundState()
    }

    // MARK: Start

    /// Called from `applicationDidFinishLaunching`, never earlier: a window on
    /// screen before the app has finished launching makes AppKit activate it.
    func start() {
        log.write("start \(Constants.version) home \(paths.root)")
        jingles = Jingles(folder: "\(options.assets)/sounds", onProblem: { [log] in log.write("error \($0)") })
        place(on: NSScreen.main ?? NSScreen.screens[0], animated: false)

        let page = pageURL(assets: options.assets)
        web.loadFileURL(page.url, allowingReadAccessTo: page.readAccess)

        frontmostID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { [weak self] notification in
            let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.frontmostID = app?.bundleIdentifier
            self?.updateVisibility()
        }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.place(on: self.currentScreen(), animated: false)
        }

        watchSessionsFolder()
        _ = refreshStore()
        writeStatus()

        timers.append(schedule(every: Constants.snapshotEveryMs / 1000) { [weak self] in self?.tick() })
        timers.append(schedule(every: Constants.stationHeartbeatMs / 1000) { [weak self] in self?.writeStatus() })
    }

    private func schedule(every seconds: TimeInterval, _ block: @escaping () -> Void) -> Timer {
        let timer = Timer(timeInterval: seconds, repeats: true) { _ in block() }
        RunLoop.main.add(timer, forMode: .common)
        return timer
    }

    // MARK: The store

    private func watchSessionsFolder() {
        let descriptor = open(paths.sessions, O_EVTONLY)
        guard descriptor >= 0 else {
            log.write("error cannot watch \(paths.sessions): \(String(cString: strerror(errno)))")
            return
        }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: .write, queue: .main)
        source.setEventHandler { [weak self] in
            guard let self else { return }
            if self.refreshStore() { self.sendSnapshot() }
        }
        source.setCancelHandler { Darwin.close(descriptor) }
        source.resume()
        watcher = source
    }

    /// Reads every record and picks who is on air. Returns whether that
    /// changed, in who or in what their records say.
    @discardableResult
    private func refreshStore() -> Bool {
        let now = nowMilliseconds()
        let air = onAir(RecordFile.readAll(in: paths.sessions), now: now)
        let before = onAirRecords.map { $0.json as NSDictionary } as NSArray
        let after = air.map { $0.json as NSDictionary } as NSArray
        let changed = !before.isEqual(after)
        onAirRecords = air
        if air.isEmpty {
            if everOnAir && emptySince == nil { emptySince = Date() }
        } else {
            everOnAir = true
            emptySince = nil
        }
        updateVisibility()
        return changed
    }

    private func tick() {
        refreshStore()
        if shouldQuit() {
            // Look once more before giving up on the air.
            refreshStore()
            if onAirRecords.isEmpty {
                quit(reason: everOnAir
                     ? "quit: nothing on air for \(Int(Constants.stationEmptyGraceMs / 1000)) s"
                     : "quit: nothing came on air within \(Int(Constants.stationStartGraceMs / 1000)) s")
            }
        }
        sendSnapshot()
    }

    private func shouldQuit() -> Bool {
        guard onAirRecords.isEmpty else { return false }
        if everOnAir {
            guard let since = emptySince else { return false }
            return Date().timeIntervalSince(since) * 1000 >= Constants.stationEmptyGraceMs
        }
        return Date().timeIntervalSince(startedAt) * 1000 >= Constants.stationStartGraceMs
    }

    private func quit(reason: String) -> Never {
        log.write(reason)
        StationStatus.delete(at: paths.station)
        exit(0)
    }

    func writeStatus() {
        let status = StationStatus(pid: Int(getpid()), startedAt: startedAtMs, heartbeatAt: nowMilliseconds())
        do {
            try status.write(to: paths.station)
        } catch {
            log.write("error cannot write station.json: \(error)")
        }
    }

    // MARK: The page

    private func receive(_ message: PageMessage) {
        switch message {
        case .ready:
            pageReady = true
            sendSnapshot()
        case let .cue(jingle):
            if prefs.sound { jingles?.play(jingle) }
        case let .reported(at):
            prefs.lastReportAt = at
            savePrefs()
        case let .log(level, text):
            log.write("page \(level) \(text)")
        case .rendered:
            break
        }
    }

    private func sendSnapshot() {
        guard pageReady else { return }
        let message: [String: Any] = [
            "type": "snapshot",
            "now": nowMilliseconds(),
            "visible": isShown ?? false,
            "sessions": onAirRecords.map { $0.json },
            "lastReportAt": prefs.lastReportAt.map { $0 as Any } ?? NSNull(),
        ]
        send(message, to: web) { [weak self] problem in
            // The same failure every second would fill the log.
            guard let self, self.lastSendError != problem else { return }
            self.lastSendError = problem
            self.log.write("error \(problem)")
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        log.write("error page failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log.write("error page failed to load: \(error.localizedDescription)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        log.write("error the page's process ended; loading it again")
        pageReady = false
        webView.reload()
    }

    // MARK: Visibility and place

    private func updateVisibility() {
        let want = shouldShow(frontmost: frontmostID, target: options.targetBundleID) && !onAirRecords.isEmpty
        guard want != isShown else { return }
        isShown = want
        if want {
            // Never makeKeyAndOrderFront or activate: the station must not take the keyboard.
            panel.orderFrontRegardless()
        } else {
            panel.orderOut(nil)
        }
        log.write(want ? "shown" : "hidden")
        sendSnapshot()
    }

    private func currentScreen() -> NSScreen {
        let centre = NSPoint(x: panel.frame.midX, y: panel.frame.midY)
        return NSScreen.screens.first { $0.frame.contains(centre) }
            ?? NSScreen.main
            ?? NSScreen.screens[0]
    }

    private func place(on screen: NSScreen, animated: Bool) {
        let frame = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: screen.visibleFrame)
        log.write("place \(quadrant.rawValue) in \(NSStringFromRect(screen.visibleFrame)) at \(NSStringFromRect(frame))")
        if animated {
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = 0.2
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrame(frame, display: true)
            }, completionHandler: { [panel] in panel.invalidateShadow() })
        } else {
            panel.setFrame(frame, display: true)
            panel.invalidateShadow()
        }
    }

    // MARK: InteractionDelegate

    func fullSize() -> CGSize {
        Geometry.pipSize(visible: currentScreen().visibleFrame.size)
    }

    func dragDidMove() {
        let screen = currentScreen()
        let centre = CGPoint(x: panel.frame.midX, y: panel.frame.midY)
        let landed = Geometry.quadrant(containing: centre, visible: screen.visibleFrame)
        if landed != quadrant {
            quadrant = landed
            prefs.quadrant = landed
            savePrefs()
            log.write("quadrant \(landed.rawValue)")
        }
        place(on: screen, animated: true)
    }

    func dragDidResize() {
        let scale = Geometry.scale(forWidth: panel.frame.width, full: fullSize())
        prefs.scale = Double(scale)
        savePrefs()
        log.write("scale \(String(format: "%.3f", prefs.scale))")
    }

    // MARK: The buttons

    private func close() {
        log.write("close")
        do {
            try StationControl(closedAt: nowMilliseconds()).write(to: paths.control)
        } catch {
            log.write("error cannot write control.json: \(error)")
        }
        quit(reason: "quit: the close button")
    }

    private func toggleSound() {
        prefs.sound.toggle()
        savePrefs()
        log.write(prefs.sound ? "sound on" : "sound off")
        showSoundState()
    }

    private func showSoundState() {
        if prefs.sound {
            chrome.sound.set(symbol: "speaker.wave.2.fill", label: "Mute")
        } else {
            chrome.sound.set(symbol: "speaker.slash.fill", label: "Unmute")
        }
    }

    private func backToClaude() {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: options.targetBundleID) else {
            log.write("error no app with the bundle id \(options.targetBundleID)")
            return
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: url, configuration: configuration) { [log] _, error in
            if let error { log.write("error cannot open \(url.path): \(error.localizedDescription)") }
        }
    }

    private func savePrefs() {
        do {
            try StationPrefs.save(prefs, to: paths.prefs)
        } catch {
            log.write("error cannot write prefs.json: \(error)")
        }
    }
}
