import AppKit
import ObjectiveC
import StationCore

/// The status-bar window level.
let stationLevel = Int(CGWindowLevelForKey(.statusWindow))

/// The window recipe: borderless and non-activating, at level 25, on every
/// Space and beside full-screen apps. It can never become key or main.
final class StationPanel: NSPanel {
    /// Whether `init` managed to force the active appearance (see `forceActiveAppearance`).
    private(set) var hasForcedActiveAppearance = false

    init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 320, height: 180),
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered,
                   defer: false)
        // Not isFloatingPanel: its setter puts the level back to .floating.
        level = NSWindow.Level(rawValue: stationLevel)
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isReleasedWhenClosed = false
        hasForcedActiveAppearance = forceActiveAppearance()
    }

    /// Draws the panel with an active appearance, as a key window would be, without ever making it key or main.
    /// AppKit draws Liquid Glass flat in a window without one, and this panel can never become key. A private
    /// interface, looked up at run time; false when this macOS lacks it.
    @discardableResult
    func forceActiveAppearance() -> Bool {
        let selector = NSSelectorFromString("_setForceMainAppearance:")
        guard responds(to: selector), let method = class_getInstanceMethod(NSWindow.self, selector) else { return false }
        typealias Set = @convention(c) (AnyObject, Selector, Bool) -> Void
        unsafeBitCast(method_getImplementation(method), to: Set.self)(self, selector, true)
        return true
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// What the interaction view asks of the window's owner while a drag runs.
protocol InteractionDelegate: AnyObject {
    var quadrant: Quadrant { get }
    /// The window's size at full scale on the screen that holds it.
    func fullSize() -> CGSize
    func dragDidMove()
    func dragDidResize()
}

/// The transparent view above the web view that takes every click and drag, so
/// the web view never receives an event and never takes focus. The buttons sit
/// above it and win where they are.
final class InteractionView: NSView {
    weak var delegate: InteractionDelegate?
    /// Called as the pointer enters and leaves the window.
    var onHover: ((Bool) -> Void)?

    private enum Drag {
        case move
        case resize(ResizeEdge)
    }

    private var drag: Drag?
    private var startMouse = NSPoint.zero
    private var startFrame = NSRect.zero
    private var didDrag = false

    override init(frame: NSRect) {
        super.init(frame: frame)
        autoresizingMask = [.width, .height]
        addTrackingArea(NSTrackingArea(rect: .zero,
                                       options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: nil))
    }

    required init?(coder: NSCoder) { fatalError("not loaded from a nib") }

    override func hitTest(_ point: NSPoint) -> NSView? {
        frame.contains(point) ? self : nil
    }

    // The panel can never become key, so every click is a first-mouse click.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    /// The resize pointer over a grip, the arrow elsewhere. `point` is in this view's coordinates.
    private func updatePointer(at point: NSPoint) {
        if let window, let delegate,
           let edge = Geometry.grip(at: point, in: bounds.size, quadrant: delegate.quadrant) {
            resizePointer(for: edge, room: Geometry.room(width: window.frame.width, full: delegate.fullSize())).set()
        } else {
            NSCursor.arrow.set()
        }
    }

    override func mouseMoved(with event: NSEvent) {
        updatePointer(at: convert(event.locationInWindow, from: nil))
    }

    override func mouseEntered(with event: NSEvent) {
        onHover?(true)
        updatePointer(at: convert(event.locationInWindow, from: nil))
    }

    override func mouseExited(with event: NSEvent) {
        onHover?(false)
        // During a drag the pointer may leave the window and keeps the edge's arrows.
        if drag == nil { NSCursor.arrow.set() }
    }

    override func mouseDown(with event: NSEvent) {
        guard let window else { return }
        // Screen coordinates: locationInWindow jitters while the window moves.
        startMouse = NSEvent.mouseLocation
        startFrame = window.frame
        didDrag = false
        let point = convert(event.locationInWindow, from: nil)
        if let delegate, let edge = Geometry.grip(at: point, in: bounds.size, quadrant: delegate.quadrant) {
            drag = .resize(edge)
        } else {
            drag = .move
        }
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window, let drag, let delegate else { return }
        let mouse = NSEvent.mouseLocation
        let delta = CGVector(dx: mouse.x - startMouse.x, dy: mouse.y - startMouse.y)
        if abs(delta.dx) > 0 || abs(delta.dy) > 0 { didDrag = true }
        switch drag {
        case .move:
            window.setFrameOrigin(NSPoint(x: startFrame.origin.x + delta.dx, y: startFrame.origin.y + delta.dy))
        case let .resize(edge):
            let frame = Geometry.resize(start: startFrame, quadrant: delegate.quadrant, edge: edge,
                                        delta: delta, full: delegate.fullSize())
            window.setFrame(frame, display: true)
            window.invalidateShadow()
            // The edge's arrows for the whole drag, even when the pointer leaves the grip.
            resizePointer(for: edge, room: Geometry.room(width: frame.width, full: delegate.fullSize())).set()
        }
    }

    override func mouseUp(with event: NSEvent) {
        let finished = drag
        drag = nil
        if didDrag, let finished {
            switch finished {
            case .move: delegate?.dragDidMove()
            case .resize: delegate?.dragDidResize()
            }
        }
        let point = convert(event.locationInWindow, from: nil)
        if bounds.contains(point) { updatePointer(at: point) } else { NSCursor.arrow.set() }
    }
}

/// The panel's content: black, rounded, with a hairline edge. From the bottom
/// up: the web view, the dim, the interaction view, the three buttons.
final class ChromeView: NSView {
    static let cornerRadius: CGFloat = 20
    static let inset: CGFloat = 8

    let interaction = InteractionView(frame: .zero)
    let close = GlassButton(symbol: "xmark", label: "Stop tracking")
    let sound = GlassButton(symbol: "speaker.wave.2.fill", label: "Mute")
    let back = GlassButton(symbol: "pip.exit", label: "Back to Claude")

    private let dim = NSView()

    init(web: NSView) {
        super.init(frame: NSRect(x: 0, y: 0, width: 320, height: 180))
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        layer?.cornerRadius = Self.cornerRadius
        layer?.masksToBounds = true
        // A 0.5 pt inner edge of white at 16%, drawn above the picture.
        layer?.borderWidth = 0.5
        layer?.borderColor = NSColor.white.withAlphaComponent(0.16).cgColor

        web.frame = bounds
        addSubview(web)

        dim.wantsLayer = true
        dim.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.18).cgColor
        dim.frame = bounds
        dim.autoresizingMask = [.width, .height]
        dim.alphaValue = 0
        addSubview(dim)

        interaction.frame = bounds
        addSubview(interaction)

        // Pinned to the top: close at the top left; Back to Claude at the top
        // right, sound 8 pt to its left.
        let d = GlassButton.diameter
        let top = bounds.height - Self.inset - d
        close.frame = NSRect(x: Self.inset, y: top, width: d, height: d)
        close.autoresizingMask = [.maxXMargin, .minYMargin]
        back.frame = NSRect(x: bounds.width - Self.inset - d, y: top, width: d, height: d)
        back.autoresizingMask = [.minXMargin, .minYMargin]
        sound.frame = NSRect(x: bounds.width - Self.inset - d - Self.inset - d, y: top, width: d, height: d)
        sound.autoresizingMask = [.minXMargin, .minYMargin]
        for button in [close, sound, back] {
            button.alphaValue = 0
            addSubview(button)
        }

        interaction.onHover = { [weak self] hovering in self?.setHover(hovering) }
    }

    required init?(coder: NSCoder) { fatalError("not loaded from a nib") }

    /// Fades the dim and the buttons in over 0.15 s, out over 0.25 s.
    func setHover(_ hovering: Bool) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = hovering ? 0.15 : 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            let alpha: CGFloat = hovering ? 1 : 0
            dim.animator().alphaValue = alpha
            for button in [close, sound, back] { button.animator().alphaValue = alpha }
        }
    }

    // Nothing but the interaction view and the buttons takes an event.
    override func hitTest(_ point: NSPoint) -> NSView? {
        let local = superview.map { convert(point, from: $0) } ?? point
        guard bounds.contains(local) else { return nil }
        for button in [back, sound, close] {
            if let hit = button.hitTest(local) { return hit }
        }
        return interaction
    }
}
