import CoreGraphics

/// The window's opacity while Transparent window is on and the pointer is elsewhere: `pip-faded` in
/// design/tokens.json.
public let fadedAlpha = 0.4

/// The window counts as hovered while the pointer is on it, and while a press that started on it is held, through a
/// drag that carries the pointer off its edge.
public func isHovered(pointer: CGPoint, frame: CGRect, pressing: Bool) -> Bool {
    pressing || frame.contains(pointer)
}

/// The window's opacity: faded while Transparent window is on and the window is not hovered, else whole.
public func windowAlpha(transparent: Bool, hovered: Bool) -> Double {
    transparent && !hovered ? fadedAlpha : 1
}
