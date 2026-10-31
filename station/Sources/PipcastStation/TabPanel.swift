import AppKit
import StationCore

/// The minimize handle and the tab it becomes at the screen's edge: one small panel of its own, the same recipe as
/// the window's. It is attached to nothing: the station moves it with the window.
final class TabPanel: NSPanel {
    let handle = HandleView()

    init() {
        super.init(contentRect: NSRect(origin: .zero, size: ControlSizes.reference.handle),
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered,
                   defer: false)
        // One level above the window, so the handle shows over it without being attached to it.
        level = NSWindow.Level(rawValue: stationLevel + 1)
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        // The glass draws its own.
        hasShadow = false
        isReleasedWhenClosed = false
        animationBehavior = .none
        contentView = handle
        forceActiveAppearance()
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    /// Sizes the handle, and the tab it becomes, for a screen. The station sets the panel's frame.
    func size(_ controls: ControlSizes) { handle.size(controls) }

    // Placed wherever the slide puts it, partly off a screen included.
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

/// The glass capsule on the window's inner edge, sized for the screen (28 x 88 pt on a 14-inch MacBook Pro), and the same piece docked at the screen's edge. Drawn
/// from the bottom up: the glass, a dark overlay that comes with the dock, the chevron.
final class HandleView: NSView {
    /// A click on it, a pull of the docked tab toward the middle of the screen, or VoiceOver's press.
    var onPress: (() -> Void)?
    /// The pointer entered or left it: the owner looks again at where the pointer is.
    var onPointer: (() -> Void)?

    /// 0 = on the window, 1 = the tab at the edge.
    private(set) var docked = 0.0

    private let glass: NSView
    private let overlay = NSView()
    private let chevron = NSImageView()
    private var side = Side.right
    private var controls = ControlSizes.reference
    private var pressStart: NSPoint?
    private var travelled = false
    private var pulled = false
    private var isHovered = false {
        didSet { updateTint() }
    }

    init() {
        let frame = NSRect(origin: .zero, size: ControlSizes.reference.handle)
        if #available(macOS 26.0, *) {
            let view = NSGlassEffectView(frame: frame)
            view.style = .clear
            view.cornerRadius = ControlSizes.reference.handleRadius
            glass = view
        } else {
            let view = NSVisualEffectView(frame: frame)
            view.material = .hudWindow
            view.blendingMode = .behindWindow
            view.state = .active
            view.maskImage = Self.capsuleMask(radius: ControlSizes.reference.handleRadius)
            glass = view
        }
        super.init(frame: frame)
        wantsLayer = true
        layer?.masksToBounds = true

        addSubview(glass)

        overlay.wantsLayer = true
        overlay.layer?.backgroundColor = NSColor.black.cgColor
        overlay.layer?.cornerRadius = ControlSizes.reference.handleRadius
        overlay.layer?.masksToBounds = true
        overlay.alphaValue = 0
        addSubview(overlay)

        chevron.imageScaling = .scaleNone
        chevron.imageAlignment = .alignCenter
        chevron.contentTintColor = .white
        chevron.setAccessibilityElement(false)
        chevron.wantsLayer = true
        chevron.frame = bounds
        addSubview(chevron)

        addTrackingArea(NSTrackingArea(rect: .zero,
                                       options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: nil))
        setAccessibilityElement(true)
        setAccessibilityRole(.button)
        show(docked: 0, side: .right)
        updateTint()
    }

    required init?(coder: NSCoder) { fatalError("not loaded from a nib") }

    private static func capsuleMask(radius: CGFloat) -> NSImage {
        let image = NSImage(size: NSSize(width: radius * 2, height: radius * 2), flipped: false) { rect in
            NSColor.black.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
            return true
        }
        image.capInsets = NSEdgeInsets(top: radius, left: radius, bottom: radius, right: radius)
        return image
    }

    /// Sizes the handle for a screen: the capsule, its corners and the chevron. The station sets the panel's frame.
    func size(_ controls: ControlSizes) {
        guard controls != self.controls else { return }
        self.controls = controls
        if #available(macOS 26.0, *), let view = glass as? NSGlassEffectView {
            view.cornerRadius = controls.handleRadius
        } else if let view = glass as? NSVisualEffectView {
            view.maskImage = Self.capsuleMask(radius: controls.handleRadius)
        }
        overlay.layer?.cornerRadius = controls.handleRadius
        // The chevron is laid out unturned, then made again at its new size: show(docked:side:) turns it back.
        chevron.frameCenterRotation = 0
        chevron.frame = NSRect(origin: .zero, size: controls.handle)
        chevron.image = nil
        show(docked: docked, side: side)
    }

    /// Draws the handle (`docked` 0) or the tab (`docked` 1), or a moment between. The glass and the overlay grow by the handle's radius
    /// past the outer edge as it docks, where the view clips them, so the outer side shows flat and the inner corners
    /// stay round; the overlay darkens; the chevron turns over. The caller sets it every frame, so nothing animates here.
    func show(docked: Double, side: Side) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }

        self.docked = docked
        if side != self.side || chevron.image == nil {
            self.side = side
            let name = side == .right ? "chevron.compact.right" : "chevron.compact.left"
            let configuration = NSImage.SymbolConfiguration(pointSize: controls.chevron, weight: .semibold)
            chevron.image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?
                .withSymbolConfiguration(configuration)
        }
        let growth = controls.handleRadius * CGFloat(docked)
        let frame = NSRect(x: side == .right ? 0 : -growth, y: 0,
                           width: controls.handle.width + growth, height: controls.handle.height)
        glass.frame = frame
        overlay.frame = frame
        overlay.alphaValue = CGFloat(Minimize.tabDark * docked)
        chevron.frameCenterRotation = CGFloat(180 * docked)
        if docked < 0.5 {
            setAccessibilityLabel(side == .right ? "Minimize to the right" : "Minimize to the left")
        } else {
            setAccessibilityLabel("Bring the window back")
        }
    }

    /// The real glass needs no tint at rest; under the pointer it brightens with white at 10%.
    private func updateTint() {
        guard #available(macOS 26.0, *), let glass = glass as? NSGlassEffectView else { return }
        glass.tintColor = isHovered ? NSColor.white.withAlphaComponent(0.10) : nil
    }

    // The glass and the chevron never take an event: the handle is the target.
    override func hitTest(_ point: NSPoint) -> NSView? {
        frame.contains(point) ? self : nil
    }

    // The panel can never become key, so every click is a first-mouse click.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        NSCursor.arrow.set()
        onPointer?()
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        onPointer?()
    }

    override func mouseDown(with event: NSEvent) {
        pressStart = NSEvent.mouseLocation
        travelled = false
        pulled = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let start = pressStart, !pulled else { return }
        let mouse = NSEvent.mouseLocation
        let dx = mouse.x - start.x
        let dy = mouse.y - start.y
        if hypot(dx, dy) >= 3 { travelled = true }
        // Docked, a pull toward the middle of the screen brings the window back, once for the drag; on the window a
        // drag does nothing.
        guard docked >= 0.5 else { return }
        let toward = side == .right ? -dx : dx
        if toward >= Minimize.pullDistance {
            pulled = true
            onPress?()
        }
    }

    override func mouseUp(with event: NSEvent) {
        defer {
            pressStart = nil
            travelled = false
            pulled = false
        }
        guard pressStart != nil, !pulled, !travelled else { return }
        if bounds.contains(convert(event.locationInWindow, from: nil)) { onPress?() }
    }

    override func accessibilityPerformPress() -> Bool {
        onPress?()
        return true
    }
}
