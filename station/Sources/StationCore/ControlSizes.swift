import CoreGraphics

/// The sizes of the window's controls on one screen: the three buttons, their symbols and the inset that places them,
/// and the minimize handle with its chevron, which is the tab too. `reference` holds them as they are drawn for a
/// 14-inch MacBook Pro, whose full window is 716 pt wide; on any other screen each is that size times the screen's full
/// window width over 716, rounded to a whole point. They are worked out once for a screen and keep their size while the
/// window is resized, so in the smallest window every screen keeps the 14-inch's proportions and the handle stays clear
/// of close.
public struct ControlSizes: Equatable {
    /// The full window width the reference sizes are drawn for: the 14-inch MacBook Pro's.
    public static let referenceFullWidth: CGFloat = 716
    /// The sizes on that screen: `pip-control`, `pip-handle-width` and `pip-handle-height` in the design system.
    public static let reference = ControlSizes(button: 44, symbol: 17, inset: 8,
                                               handle: CGSize(width: 28, height: 88), chevron: 22)

    /// A button's diameter.
    public var button: CGFloat
    /// The point size of a button's symbol.
    public var symbol: CGFloat
    /// How far the buttons sit in from the window's edges and apart, and the handle in from its inner edge.
    public var inset: CGFloat
    /// The handle, and the tab it becomes at the screen's edge.
    public var handle: CGSize
    /// The point size of the handle's chevron.
    public var chevron: CGFloat

    /// The handle is a capsule.
    public var handleRadius: CGFloat { handle.width / 2 }

    public init(button: CGFloat, symbol: CGFloat, inset: CGFloat, handle: CGSize, chevron: CGFloat) {
        self.button = button
        self.symbol = symbol
        self.inset = inset
        self.handle = handle
        self.chevron = chevron
    }

    /// The sizes on a screen whose full window is `full`.
    public init(full: CGSize) {
        let k = full.width / Self.referenceFullWidth
        func scaled(_ value: CGFloat) -> CGFloat { (value * k).rounded() }
        let r = Self.reference
        self.init(button: scaled(r.button), symbol: scaled(r.symbol), inset: scaled(r.inset),
                  handle: CGSize(width: scaled(r.handle.width), height: scaled(r.handle.height)),
                  chevron: scaled(r.chevron))
    }

    /// Where the buttons sit in a window of `size`, in its own coordinates (origin bottom left): close at the top left,
    /// Back to Claude at the top right and sound to its left, each `inset` from the edges and from each other.
    public func buttonFrames(in size: CGSize) -> (close: CGRect, sound: CGRect, back: CGRect) {
        let top = size.height - inset - button
        let back = CGRect(x: size.width - inset - button, y: top, width: button, height: button)
        let sound = CGRect(x: back.minX - inset - button, y: top, width: button, height: button)
        let close = CGRect(x: inset, y: top, width: button, height: button)
        return (close, sound, back)
    }
}
