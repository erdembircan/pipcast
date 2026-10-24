import AppKit

/// One of the four 44 pt circles on the window: Liquid Glass on macOS 26 and
/// later, a HUD-material blur before it, with a white SF Symbol in it.
/// It sets no tooltip: nothing pops up over it.
final class GlassButton: NSView {
    static let diameter: CGFloat = 44
    static let symbolSize: CGFloat = 17

    var onPress: (() -> Void)?

    private let symbolView = NSImageView()
    private var glass: NSView?
    private var isPressing = false
    private var isHovered = false {
        didSet { updateTint() }
    }

    init(symbol: String, label: String) {
        super.init(frame: NSRect(x: 0, y: 0, width: Self.diameter, height: Self.diameter))
        wantsLayer = true

        symbolView.imageScaling = .scaleNone
        symbolView.imageAlignment = .alignCenter
        symbolView.contentTintColor = .white
        symbolView.setAccessibilityElement(false)
        symbolView.frame = bounds

        if #available(macOS 26.0, *) {
            let view = NSGlassEffectView(frame: bounds)
            view.style = .clear
            view.cornerRadius = Self.diameter / 2
            view.contentView = symbolView
            glass = view
        } else {
            let view = NSVisualEffectView(frame: bounds)
            view.material = .hudWindow
            view.blendingMode = .behindWindow
            view.state = .active
            view.maskImage = Self.circleMask()
            view.addSubview(symbolView)
            glass = view
        }
        glass?.frame = bounds
        glass?.autoresizingMask = [.width, .height]
        if let glass { addSubview(glass) }

        set(symbol: symbol, label: label)
        updateTint()

        addTrackingArea(NSTrackingArea(rect: .zero,
                                       options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: nil))
        setAccessibilityElement(true)
        setAccessibilityRole(.button)
    }

    required init?(coder: NSCoder) { fatalError("not loaded from a nib") }

    /// Shows another symbol and names the button for VoiceOver.
    func set(symbol: String, label: String) {
        let configuration = NSImage.SymbolConfiguration(pointSize: Self.symbolSize, weight: .semibold)
        symbolView.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(configuration)
        setAccessibilityLabel(label)
    }

    private static func circleMask() -> NSImage {
        let image = NSImage(size: NSSize(width: diameter, height: diameter), flipped: false) { rect in
            NSColor.black.setFill()
            NSBezierPath(ovalIn: rect).fill()
            return true
        }
        image.capInsets = NSEdgeInsets(top: diameter / 2, left: diameter / 2, bottom: diameter / 2, right: diameter / 2)
        return image
    }

    /// The real glass needs no tint at rest; under the pointer it brightens with white at 10%.
    private func updateTint() {
        guard #available(macOS 26.0, *), let glass = glass as? NSGlassEffectView else { return }
        glass.tintColor = isHovered ? NSColor.white.withAlphaComponent(0.10) : nil
    }

    // The glass and the symbol inside never take an event: the button is the target.
    override func hitTest(_ point: NSPoint) -> NSView? {
        frame.contains(point) ? self : nil
    }

    // The panel can never become key, so every click is a first-mouse click.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseEntered(with event: NSEvent) { isHovered = true }

    override func mouseExited(with event: NSEvent) { isHovered = false }

    override func mouseDown(with event: NSEvent) {
        isPressing = true
    }

    override func mouseUp(with event: NSEvent) {
        let inside = bounds.contains(convert(event.locationInWindow, from: nil))
        defer { isPressing = false }
        if isPressing && inside { onPress?() }
    }

    override func accessibilityPerformPress() -> Bool {
        onPress?()
        return true
    }
}
