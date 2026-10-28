import AppKit
import StationCore
import StationSound
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
    /// The minimize handle on the window, and the tab it leaves at the screen's edge.
    private let tab = TabPanel()
    /// The window server's Spaces, or nil on a macOS without the private calls.
    private let spaces = WindowServerSpaces()
    private var lastSpacesLines: [Int: String] = [:]
    private let bridge = PageBridge()
    private let web: StationWebView
    private let chrome: ChromeView
    private let content: PanelContent
    /// The jingles and the beat, played as the page's events come.
    private var sound: SoundDesk?

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
    private var selfCaptureScheduled = false
    /// Whether the window counts as hovered, as the station last looked: the controls show and the window is whole.
    /// Never while it is hidden.
    private var hovered = false
    /// Transparent window, as options.json last said.
    private var transparent = false
    /// The self-capture holds the controls up.
    private var holdingControls = false
    #if PIPCAST_DEV
    /// The development build's cues (DevCues.swift).
    private let devCues: DevCues
    #endif

    /// Whether the window is open, minimized to the side, or out for a segment, and the decisions about it.
    private var model: MinimizeModel
    /// The slide running now, with the time it started and the display link that drives it.
    private var slide: Slide?
    private var slideStart: CFTimeInterval = 0
    private var slideAlpha: CGFloat = 1
    private var slideScreen: NSScreen?
    private var displayLink: CADisplayLink?
    /// Whether the pointer is on the docked tab, as the station last looked.
    private var tabHovered = false
    /// How docked the handle is: 0 on the window, 1 the tab at the edge.
    private var docked = 0.0

    /// Whether the window is out in its quadrant and still: what the page is told.
    private var windowOut: Bool { model.isOut && slide == nil }

    init(options: StationOptions) {
        self.options = options
        paths = StorePaths(home: options.home)
        log = StationLog(path: paths.log)
        prefs = StationPrefs.load(from: paths.prefs)
        quadrant = prefs.quadrant
        model = MinimizeModel(minimized: prefs.minimized)
        #if PIPCAST_DEV
        devCues = DevCues(paths: paths)
        #endif
        web = makeStationWebView(bridge: bridge)
        chrome = ChromeView(web: web)
        content = PanelContent(chrome: chrome)
        super.init()

        web.navigationDelegate = self
        panel.contentView = content
        chrome.interaction.delegate = self
        chrome.interaction.onPointer = { [weak self] in self?.followPointer() }
        chrome.close.onPress = { [weak self] in self?.close() }
        chrome.sound.onPress = { [weak self] in self?.toggleSound() }
        chrome.back.onPress = { [weak self] in self?.backToClaude() }
        tab.handle.onPress = { [weak self] in
            guard let self else { return }
            self.act(self.model.mode == .minimized ? .bringBack : .minimize)
        }
        tab.handle.onPointer = { [weak self] in self?.followPointer() }
        bridge.onMessage = { [weak self] message in self?.receive(message) }
        showSoundState()
    }

    // MARK: Start

    /// Called from `applicationDidFinishLaunching`, never earlier: a window on
    /// screen before the app has finished launching makes AppKit activate it.
    func start() {
        log.write("start \(Constants.version) home \(paths.root)")
        #if PIPCAST_DEV
        do {
            try devCues.prepare()
            log.write("dev: the development build, taking cues from \(devCues.folder)")
        } catch {
            log.write("error dev: cannot make \(devCues.folder): \(error)")
        }
        #endif
        log.write(allowPointerInBackground()
                  ? "pointer: set in the background"
                  : "error cannot set the pointer in the background")
        log.write(panel.hasForcedActiveAppearance
                  ? "glass: active appearance forced"
                  : "error cannot force the window's active appearance; the glass draws flat")
        log.write(spaces != nil
                  ? "spaces: off the target's own full-screen Spaces"
                  : "error cannot keep the window off the target's own full-screen Spaces; it can show there as you switch to it")
        transparent = SharedOptions.load(from: paths.options).transparent
        log.write(transparent ? "transparent on" : "transparent off")
        if model.mode == .minimized { log.write("minimized") }
        sound = SoundDesk(folder: URL(fileURLWithPath: "\(options.assets)/sounds"), log: { [log] in log.write($0) })
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
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.keepOffOwnSpaces()
            self?.updateVisibility()
            self?.keepOnActiveSpace()
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
        keepOffOwnSpaces()
        readOptions()
        refreshStore()
        #if PIPCAST_DEV
        forwardDevCues()
        #endif
        // macOS tells a window nothing when it appears under a resting pointer, or moves out from under it.
        followPointer()
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
        #if PIPCAST_DEV
        // The development build says so, for scripts/cue.mjs and scripts/live.sh to tell it from the station that ships
        let status = StationStatus(pid: Int(getpid()), startedAt: startedAtMs, heartbeatAt: nowMilliseconds(),
                                   version: "\(Constants.version)+dev")
        #else
        let status = StationStatus(pid: Int(getpid()), startedAt: startedAtMs, heartbeatAt: nowMilliseconds())
        #endif
        do {
            try status.write(to: paths.station)
        } catch {
            log.write("error cannot write station.json: \(error)")
        }
    }

    // MARK: The page

    private func receive(_ message: PageMessage) {
        #if PIPCAST_DEV
        // The development build logs what the page asks it to play, and when it wants the window, so station.log
        // says what aired
        switch message {
        case let .cue(jingle): log.write("dev: page cue \(jingle)")
        case let .bed(bed): log.write("dev: page bed \(bed)")
        case .bedOut: log.write("dev: page bed-out")
        case .hush: log.write("dev: page hush")
        case let .window(wanted): log.write("dev: page window \(wanted ? "wanted" : "let go")")
        case let .reported(at): log.write("dev: page reported \(Int(at))")
        default: break
        }
        #endif
        switch message {
        case .ready:
            pageReady = true
            // A page that has loaded again has nothing playing yet
            sound?.hush()
            act(.pageReady(hovered: hovered))
            sendSnapshot()
        case let .cue(jingle):
            if prefs.sound { sound?.cue(jingle) }
        case let .bed(bed):
            if prefs.sound { sound?.bedIn(bed) }
        case .bedOut:
            sound?.bedOut()
        case .hush:
            sound?.hush()
        case let .reported(at):
            prefs.lastReportAt = at
            savePrefs()
        case let .log(level, text):
            log.write("page \(level) \(text)")
        case let .window(wanted):
            if wanted {
                if prefs.sound { sound?.warm() }
            } else {
                sound?.windowLetGo()
            }
            act(.wanted(wanted, hovered: hovered))
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
            "windowOut": windowOut,
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

    #if PIPCAST_DEV
    /// Hands each cue waiting in the dev folder to the page, oldest first, and deletes it. Not before the page listens:
    /// a cue sent then would be lost.
    private func forwardDevCues() {
        guard pageReady else { return }
        for path in devCues.waiting() {
            let name = (path as NSString).lastPathComponent
            let data = FileManager.default.contents(atPath: path)
            try? FileManager.default.removeItem(atPath: path)
            guard let data, let text = String(data: data, encoding: .utf8) else {
                log.write("error dev: cannot read the cue \(name)")
                continue
            }
            log.write("dev: cue \(name)")
            send(["type": "dev", "cue": text], to: web) { [weak self] problem in
                self?.log.write("error dev: \(problem)")
            }
        }
    }
    #endif

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
        let target = options.targetBundleID
        // Only worth asking the window server while another app is in front.
        let onOwnSpace = frontmostID != target && isOnOwnSpace()
        let want = shouldShow(frontmost: frontmostID, target: target, onTargetsOwnSpace: onOwnSpace)
            && !onAirRecords.isEmpty
        guard want != isShown else { return }
        isShown = want
        if want {
            // It shows with the look the pointer asks for: hovered if the pointer is already on it.
            hovered = pointerIsOn()
            tabHovered = model.mode == .minimized && tab.frame.contains(NSEvent.mouseLocation)
            // Never makeKeyAndOrderFront or activate: the station must not take the keyboard.
            tab.forceActiveAppearance()
            if model.mode == .minimized {
                // Minimized, only the tab shows, docked at the edge.
                showLook(animated: false)
                tab.orderFrontRegardless()
            } else {
                showLook(animated: false)
                panel.forceActiveAppearance()
                panel.animationBehavior = .default
                panel.orderFrontRegardless()
            }
            keepOnActiveSpace()
            keepOffOwnSpaces()
            // The window server puts a window that has just come on screen on its Spaces a moment later.
            DispatchQueue.main.async { [weak self] in self?.keepOffOwnSpaces() }
            scheduleSelfCaptureOnce()
        } else {
            // A slide stops where it is and ends as it would have, with no motion; a segment's window goes back
            // into the side.
            finishSlide()
            act(.hidden)
            // At once: AppKit's fade would leave the window on screen for a quarter of a second more. The tab goes too.
            hideTab()
            panel.animationBehavior = .none
            panel.orderOut(nil)
            // Hidden, it is hovered by nothing; it looks at the pointer again as it shows.
            hovered = false
            tabHovered = false
            showLook(animated: false)
        }
        log.write(want ? "shown" : "hidden")
        sendSnapshot()
    }

    /// The target's own full-screen Spaces now: the ones it fills alone.
    private func ownSpaces() -> [UInt64] {
        guard let spaces else { return [] }
        let pids = NSRunningApplication.runningApplications(withBundleIdentifier: options.targetBundleID)
            .map { Int($0.processIdentifier) }
        return Spaces.ownFullScreen(in: spaces.displays(), pids: Set(pids))
    }

    /// Whether you are on one of the target's own full-screen Spaces.
    private func isOnOwnSpace() -> Bool {
        guard let spaces else { return false }
        return ownSpaces().contains(spaces.active())
    }

    /// Takes the window off the target's own full-screen Spaces it is on. The window server puts a window that
    /// shows on every Space on those too, and draws it there all through a switch to the target, before macOS
    /// says the target is in front. Off a Space, the window stays off it; a new one, from the target going full
    /// screen again, is caught here within a second.
    private func keepOffOwnSpaces() {
        guard let spaces else { return }
        let own = ownSpaces()
        guard !own.isEmpty else { return }
        // The window and the tab, which is a window of its own.
        for (panel, name) in [(panel as NSPanel, "window"), (tab as NSPanel, "tab")] where panel.windowNumber > 0 {
            let window = CGWindowID(panel.windowNumber)
            let on = spaces.spaces(of: window).filter(own.contains)
            guard !on.isEmpty else { continue }
            spaces.remove(window, from: on)
            let still = spaces.spaces(of: window).filter(own.contains)
            let list = { (ids: [UInt64]) in ids.map(String.init).joined(separator: ", ") }
            let line = still.isEmpty
                ? (name == "window" ? "" : "\(name) ") + "off the target's full-screen Space \(list(on))"
                : "error the \(name) is still on the target's full-screen Space \(list(still))"
            // Once for each change, not once a second.
            if line != lastSpacesLines[panel.windowNumber] {
                log.write(line)
                lastSpacesLines[panel.windowNumber] = line
            }
        }
    }

    /// Puts the window, or the tab, back on every Space when the window server has left it off the one you are on: on
    /// 24 October it kept the window on one desktop alone. Clearing `canJoinAllSpaces`, committing that, and setting it
    /// again makes AppKit put a window on every Space; without the commit in between AppKit sees no change. Claude's own
    /// full-screen Spaces are taken off it again right after. Called as the window shows and each time you switch Spaces.
    private func keepOnActiveSpace() {
        guard isShown == true, slide == nil else { return }
        var moved = false
        for (window, name) in [(panel as NSPanel, "window"), (tab as NSPanel, "tab")]
        where window.isVisible && !window.isOnActiveSpace {
            window.collectionBehavior.remove(.canJoinAllSpaces)
            CATransaction.flush()
            window.collectionBehavior.insert(.canJoinAllSpaces)
            CATransaction.flush()
            log.write("\(name) back on every Space: it was off the one you are on")
            moved = true
        }
        if moved { keepOffOwnSpaces() }
    }

    /// With `PIPCAST_SELF_CAPTURE` set to a file path: once, 1.5 s after the window is first shown, shows the controls
    /// and writes the station's own picture of its window there, for checking the glass by eye.
    private func scheduleSelfCaptureOnce() {
        guard !selfCaptureScheduled,
              let path = ProcessInfo.processInfo.environment["PIPCAST_SELF_CAPTURE"], !path.isEmpty else { return }
        selfCaptureScheduled = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self else { return }
            self.holdingControls = true
            self.followPointer()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                guard let self else { return }
                if writeSelfCapture(of: self.panel, to: path) {
                    self.log.write("self-capture \(path)")
                } else {
                    self.log.write("error self-capture failed")
                }
                self.holdingControls = false
                self.followPointer()
            }
        }
    }

    /// The screen the window is on: while it slides, the one it started on; minimized, the one that holds the tab;
    /// else the one that holds the window's centre. A centre past every screen, as when the window is dropped past
    /// the edge, belongs to the nearest.
    private func currentScreen() -> NSScreen {
        if let slideScreen { return slideScreen }
        let frame = model.mode == .minimized && !panel.isVisible ? tab.frame : panel.frame
        let centre = NSPoint(x: frame.midX, y: frame.midY)
        func distance(_ screen: NSScreen) -> CGFloat {
            let dx = max(screen.frame.minX - centre.x, 0, centre.x - screen.frame.maxX)
            let dy = max(screen.frame.minY - centre.y, 0, centre.y - screen.frame.maxY)
            return hypot(dx, dy)
        }
        return NSScreen.screens.min { distance($0) < distance($1) } ?? NSScreen.main ?? NSScreen.screens[0]
    }

    private func place(on screen: NSScreen, animated: Bool) {
        // A slide ends where it was going, at once.
        finishSlide()
        let frame = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: screen.visibleFrame)
        if model.mode == .minimized {
            // Minimized, the window rests ordered out and the tab sits against the edge.
            let tabFrame = Minimize.tab(rest: frame, visible: screen.visibleFrame, side: quadrant.side)
            if frame == panel.frame && tabFrame == tab.frame { return }
            log.write("place \(quadrant.rawValue) in \(NSStringFromRect(screen.visibleFrame)) at \(NSStringFromRect(frame))")
            panel.setFrame(frame, display: false)
            tab.setFrame(tabFrame, display: true)
            tab.handle.show(docked: 1, side: quadrant.side)
            docked = 1
            return
        }
        // Screen-change notifications can come in bursts; a window already in place stays as it is.
        if frame == panel.frame { return }
        log.write("place \(quadrant.rawValue) in \(NSStringFromRect(screen.visibleFrame)) at \(NSStringFromRect(frame))")
        if animated {
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = 0.2
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrame(frame, display: true)
                // The handle is attached to nothing: it makes the same move.
                if tab.isVisible && model.mode != .minimized {
                    let side = Minimize.side(of: frame, visible: screen.visibleFrame)
                    tab.animator().setFrame(Minimize.handle(on: frame, side: side), display: true)
                }
            }, completionHandler: { [weak self] in
                self?.panel.invalidateShadow()
                self?.placeHandle()
                // The window may have moved out from under the pointer.
                self?.followPointer()
            })
        } else {
            panel.setFrame(frame, display: true)
            panel.invalidateShadow()
            placeHandle()
        }
    }

    // MARK: Hover and Transparent window

    /// Follows options.json: Transparent window, logged as it changes.
    private func readOptions() {
        let now = SharedOptions.load(from: paths.options).transparent
        guard now != transparent else { return }
        transparent = now
        log.write(now ? "transparent on" : "transparent off")
        showLook(animated: isShown == true)
    }

    /// Whether the window counts as hovered now, from where the pointer is. Never while it is minimized or sliding.
    private func pointerIsOn() -> Bool {
        guard model.mode != .minimized, slide == nil else { return false }
        return holdingControls
            || isHovered(pointer: NSEvent.mouseLocation, frame: panel.frame, pressing: chrome.interaction.isPressing)
    }

    /// Looks at the pointer again. As the window comes to count as hovered, the dim and the controls fade in, and
    /// with Transparent window on the window turns whole with them; as it stops, they fade back. A minimized
    /// window's tab turns whole under the pointer. A segment's window that is due back waits here for the pointer
    /// to leave.
    private func followPointer() {
        guard slide == nil else { return }
        let now = isShown == true && pointerIsOn()
        let overTab = isShown == true && model.mode == .minimized && tab.frame.contains(NSEvent.mouseLocation)
        let hoveredChanged = now != hovered
        let tabChanged = overTab != tabHovered
        hovered = now
        tabHovered = overTab
        if hoveredChanged || tabChanged { showLook(animated: true) }
        if hoveredChanged && !hovered && model.waitingForPointer { act(.pointerLeft) }
    }

    /// The controls while hovered, and the window's opacity: in over 0.15 s, out over 0.25 s. With them the handle on
    /// the window, or the tab at the edge.
    private func showLook(animated: Bool) {
        let alpha = CGFloat(windowAlpha(transparent: transparent, hovered: hovered))
        let sliding = slide != nil
        guard animated else {
            chrome.showControls(hovered, animated: false)
            if !sliding { panel.alphaValue = alpha }
            showHandle(animated: false)
            return
        }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = hovered ? 0.15 : 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            chrome.showControls(hovered, animated: true)
            if !sliding { panel.animator().alphaValue = alpha }
            showHandle(animated: true)
        }, completionHandler: { [weak self] in
            // An invisible handle must not catch clicks or be listed on screen.
            guard let self, self.slide == nil, self.model.mode != .minimized, !self.hovered else { return }
            self.hideTab()
        })
    }

    /// The handle on the window while it is out and hovered, the docked tab while it is minimized; inside the
    /// animation group of `showLook` when animated.
    private func showHandle(animated: Bool) {
        guard slide == nil, isShown == true else { return }
        func setAlpha(_ alpha: CGFloat) {
            if animated { tab.animator().alphaValue = alpha } else { tab.alphaValue = alpha }
        }
        if model.mode == .minimized {
            let screen = currentScreen()
            let rest = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: screen.visibleFrame)
            tab.setFrame(Minimize.tab(rest: rest, visible: screen.visibleFrame, side: quadrant.side), display: true)
            tab.handle.show(docked: 1, side: quadrant.side)
            docked = 1
            tab.orderFrontRegardless()
            setAlpha(CGFloat(windowAlpha(transparent: transparent, hovered: tabHovered)))
        } else if hovered {
            let side = Minimize.side(of: panel.frame, visible: currentScreen().visibleFrame)
            tab.setFrame(Minimize.handle(on: panel.frame, side: side), display: true)
            tab.handle.show(docked: 0, side: side)
            docked = 0
            if !tab.isVisible { tab.alphaValue = 0 }
            tab.orderFrontRegardless()
            setAlpha(1)
        } else if tab.isVisible {
            setAlpha(0)
            if !animated { hideTab() }
        }
    }

    /// Puts the hover handle where the window is now, on the inner edge of the side it would go to, so it follows a
    /// drag across the middle of the screen, a resize and the snap into a corner. Nothing while it is not shown on the window.
    private func placeHandle() {
        guard slide == nil, model.mode != .minimized, tab.isVisible else { return }
        let side = Minimize.side(of: panel.frame, visible: currentScreen().visibleFrame)
        tab.setFrame(Minimize.handle(on: panel.frame, side: side), display: true)
        tab.handle.show(docked: 0, side: side)
    }

    /// Takes the tab off the screen.
    private func hideTab() {
        tab.orderOut(nil)
    }

    // MARK: Minimizing to the side

    /// Every event about minimizing goes through here: the model decides, this logs it and does what it asks.
    private func act(_ event: MinimizeModel.Event) {
        let before = model
        let effects = model.handle(event)
        let side = quadrant.side.rawValue
        switch (before.mode, model.mode, event) {
        case (.open, .minimized, .minimize): log.write("minimize \(side)")
        case (.borrowed, .minimized, .minimize): log.write("minimize \(side) during a segment")
        case (.minimized, .open, .bringBack): log.write("bring back")
        case (.minimized, .borrowed, _): log.write("out for a segment")
        case (.borrowed, .minimized, .hidden): log.write("minimized again while hidden")
        case (.borrowed, .minimized, _): log.write("back to the side")
        case (.borrowed, .borrowed, _) where model.waitingForPointer && !before.waitingForPointer:
            log.write("back to the side once the pointer leaves")
        default: break
        }
        for effect in effects { perform(effect) }
    }

    private func perform(_ effect: MinimizeModel.Effect) {
        switch effect {
        case let .save(minimized):
            prefs.minimized = minimized
            savePrefs()
        case .slideIn:
            // Hidden, the window goes without motion and nothing is ordered front.
            if isShown == true { startSlide(.into) } else { settleMinimized() }
        case .slideOut:
            if isShown == true { startSlide(.outOf) } else { settleOpen() }
        case .settleIn:
            settleMinimized()
        }
    }

    /// Starts the window into the side or out of it, from wherever it is; a slide already running is reversed from
    /// where it has got to.
    private func startSlide(_ direction: Slide.Direction) {
        let now = CACurrentMediaTime()
        let running = slide
        var dockedFrom = docked
        var handleAlphaFrom = tab.isVisible ? Double(tab.alphaValue) : 0
        let screen = running == nil ? currentScreen() : (slideScreen ?? currentScreen())
        let visible = screen.visibleFrame
        let rest = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: visible)
        let side = quadrant.side
        let from: CGRect
        if let running {
            let frame = running.frame(at: now - slideStart)
            from = frame.window
            dockedFrom = frame.docked
            handleAlphaFrom = frame.handleAlpha
            displayLink?.invalidate()
            displayLink = nil
        } else if direction == .into {
            from = panel.frame
            slideAlpha = CGFloat(windowAlpha(transparent: transparent, hovered: hovered))
        } else {
            from = Minimize.gone(rest: rest, visible: visible, side: side)
            slideAlpha = CGFloat(windowAlpha(transparent: transparent, hovered: false))
        }
        let next = Slide(direction: direction, from: from, rest: rest, visible: visible, side: side,
                         reduced: NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
                         dockedFrom: dockedFrom, handleAlphaFrom: handleAlphaFrom)
        slide = next
        slideScreen = screen
        slideStart = now

        // The tab moves on its own; a press on the window does nothing meanwhile.
        chrome.interaction.isEnabled = false
        apply(next.frame(at: 0), of: next)
        if running == nil {
            if direction == .outOf {
                panel.animationBehavior = .none
                panel.orderFrontRegardless()
            }
            tab.orderFrontRegardless()
            keepOffOwnSpaces()
        }
        let link = tab.contentView!.displayLink(target: self, selector: #selector(slideTick(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
        // The page is told at once that the window is on its way.
        sendSnapshot()
    }

    @objc private func slideTick(_ link: CADisplayLink) {
        guard let slide else {
            link.invalidate()
            return
        }
        let elapsed = CACurrentMediaTime() - slideStart
        apply(slide.frame(at: elapsed), of: slide)
        if slide.isDone(at: elapsed) { finishSlide() }
    }

    /// One moment of a slide on the screen: the window moved, cut down to the part inside the visible frame, the
    /// handle with it.
    private func apply(_ frame: SlideFrame, of slide: Slide) {
        panel.setFrameOrigin(frame.window.origin)
        let shown = Minimize.shown(window: frame.window, visible: slide.visible)
        content.clipLayout(shown: shown == .zero ? .zero : shown.offsetBy(dx: -frame.window.minX, dy: -frame.window.minY))
        panel.alphaValue = CGFloat(frame.windowAlpha) * slideAlpha
        tab.setFrame(frame.handle, display: true)
        tab.alphaValue = CGFloat(frame.handleAlpha)
        tab.handle.show(docked: frame.docked, side: slide.side)
        docked = frame.docked
        panel.invalidateShadow()
    }

    /// Ends the slide running, if any, where it was going and with no motion: the window is minimized at the edge, or
    /// out in its quadrant.
    private func finishSlide() {
        guard let slide else { return }
        displayLink?.invalidate()
        displayLink = nil
        self.slide = nil
        slideScreen = nil
        content.restLayout()
        chrome.interaction.isEnabled = true
        let rest = slide.rest
        if slide.direction == .into {
            panel.animationBehavior = .none
            panel.orderOut(nil)
            panel.setFrame(rest, display: false)
            panel.alphaValue = 1
            hovered = false
            chrome.showControls(false, animated: false)
            tab.setFrame(Minimize.tab(rest: rest, visible: slide.visible, side: slide.side), display: true)
            tab.handle.show(docked: 1, side: slide.side)
            tab.alphaValue = 1
            docked = 1
        } else {
            panel.setFrame(rest, display: true)
            panel.alphaValue = CGFloat(windowAlpha(transparent: transparent, hovered: hovered))
            panel.invalidateShadow()
            tab.setFrame(Minimize.handle(on: rest, side: slide.side), display: true)
            tab.handle.show(docked: 0, side: slide.side)
            tab.alphaValue = 1
            docked = 0
            // The page is told at once that the window is out.
            sendSnapshot()
        }
        if isShown == true {
            showLook(animated: true)
            followPointer()
        }
    }

    /// Minimized at once, with no motion and nothing ordered front: the window rests ordered out in its quadrant and
    /// the tab waits at the edge.
    private func settleMinimized() {
        finishSlide()
        let screen = currentScreen()
        let rest = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: screen.visibleFrame)
        hideTab()
        panel.animationBehavior = .none
        panel.orderOut(nil)
        panel.setFrame(rest, display: false)
        content.restLayout()
        panel.alphaValue = 1
        chrome.showControls(false, animated: false)
        hovered = false
        tab.setFrame(Minimize.tab(rest: rest, visible: screen.visibleFrame, side: quadrant.side), display: true)
        tab.handle.show(docked: 1, side: quadrant.side)
        tab.alphaValue = 1
        docked = 1
    }

    /// Out in its quadrant at once, with no motion and nothing ordered front.
    private func settleOpen() {
        finishSlide()
        let screen = currentScreen()
        let rest = Geometry.frame(quadrant: quadrant, scale: prefs.scale, visible: screen.visibleFrame)
        hideTab()
        panel.setFrame(rest, display: false)
        content.restLayout()
        panel.alphaValue = CGFloat(windowAlpha(transparent: transparent, hovered: false))
        tab.setFrame(Minimize.handle(on: rest, side: quadrant.side), display: true)
        tab.handle.show(docked: 0, side: quadrant.side)
        docked = 0
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
        placeHandle()
    }

    func dragIsMoving() {
        placeHandle()
        // A quarter of the window past the screen's left or right edge sends it into that side, with the button still
        // down. During a drag the window's centre stays on the screen it left until it is half over, so that is the
        // screen whose edge counts.
        let screen = currentScreen()
        let others = NSScreen.screens.filter { $0 != screen }.map(\.frame)
        guard let side = Minimize.side(dragged: panel.frame, visible: screen.visibleFrame, screen: screen.frame,
                                       others: others) else { return }
        chrome.interaction.endDrag()
        minimize(into: side, on: screen)
    }

    /// Minimizes the window into `side` of `screen` from wherever a drag left it; the quadrant on that side, top or
    /// bottom as the window's centre is, is kept for it.
    private func minimize(into side: Side, on screen: NSScreen) {
        let top = panel.frame.midY >= screen.visibleFrame.midY
        let landed: Quadrant = switch (side, top) {
        case (.right, true): .topRight
        case (.right, false): .bottomRight
        case (.left, true): .topLeft
        case (.left, false): .bottomLeft
        }
        if landed != quadrant {
            quadrant = landed
            prefs.quadrant = landed
            savePrefs()
            log.write("quadrant \(landed.rawValue)")
        }
        act(.minimize)
    }

    func dragIsResizing() {
        placeHandle()
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
        // Off stops what is playing; on plays from the next segment
        if !prefs.sound { sound?.hush() }
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
