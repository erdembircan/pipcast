import CoreGraphics

/// The four places the window can sit; raw values as in the contract.
public enum Quadrant: String, Codable, CaseIterable {
    case topLeft = "top-left"
    case topRight = "top-right"
    case bottomLeft = "bottom-left"
    case bottomRight = "bottom-right"

    public var isRight: Bool { self == .topRight || self == .bottomRight }
    public var isTop: Bool { self == .topLeft || self == .topRight }
}

/// The edge or corner of the window a resize drag started on.
public enum ResizeEdge: Equatable {
    case top, bottom, left, right
    case topLeft, topRight, bottomLeft, bottomRight
}

/// All in AppKit points: the origin is at the bottom left, y grows upward, and
/// the rectangles are a screen's `visibleFrame`.
public enum Geometry {
    public static let margin: CGFloat = 20
    public static let minScale = CGFloat(Constants.minScale)
    /// How close to an edge a drag starts a resize.
    public static let edgeGrip: CGFloat = 8
    /// How close to the inner corner a drag starts a corner resize: the window's corner radius.
    public static let cornerGrip: CGFloat = 20

    /// The design system's `pipSize` applied to a visible frame: a quarter of
    /// it, less `margin` on every side, at 16:9.
    public static func pipSize(visible: CGSize, margin: CGFloat = Geometry.margin) -> CGSize {
        let quarterWidth = visible.width / 2
        let quarterHeight = visible.height / 2
        var width = (quarterWidth - 2 * margin).rounded(.down)
        var height = (width * 9 / 16).rounded()
        let cap = (quarterHeight - 2 * margin).rounded(.down)
        if height > cap {
            height = cap
            width = (height * 16 / 9).rounded()
        }
        return CGSize(width: width, height: height)
    }

    /// The smallest the window can be: `minScale` of the width, at 16:9.
    public static func minSize(full: CGSize, scale: CGFloat = Geometry.minScale) -> CGSize {
        let width = (full.width * scale).rounded()
        return CGSize(width: width, height: (width * 9 / 16).rounded())
    }

    /// The window's size at a scale, which is clamped to `minScale`...1.
    public static func scaledSize(full: CGSize, scale: CGFloat) -> CGSize {
        let width = (full.width * clamp(scale)).rounded()
        return CGSize(width: width, height: (width * 9 / 16).rounded())
    }

    public static func clamp(_ scale: CGFloat) -> CGFloat {
        min(1, max(minScale, scale))
    }

    /// Where the window sits in a quadrant of the visible frame, `margin` in
    /// from the two edges it touches.
    public static func frame(quadrant: Quadrant, scale: CGFloat, visible: CGRect) -> CGRect {
        let full = pipSize(visible: visible.size)
        let size = scaledSize(full: full, scale: scale)
        let x = quadrant.isRight ? visible.maxX - margin - size.width : visible.minX + margin
        let y = quadrant.isTop ? visible.maxY - margin - size.height : visible.minY + margin
        return CGRect(origin: CGPoint(x: x, y: y), size: size)
    }

    /// The quadrant that holds a point. A point on a dividing line belongs to
    /// the right and to the top.
    public static func quadrant(containing point: CGPoint, visible: CGRect) -> Quadrant {
        let right = point.x >= visible.midX
        let top = point.y >= visible.midY
        switch (top, right) {
        case (true, true): return .topRight
        case (true, false): return .topLeft
        case (false, true): return .bottomRight
        case (false, false): return .bottomLeft
        }
    }

    /// Which resize grip a point in the window's own coordinates (origin bottom left) is on, if any. Only the edges
    /// that face the middle of the screen resize, because the outer corner stays put: for a window in a right quadrant
    /// its left edge, in a top quadrant its bottom edge, and the corner between them.
    public static func grip(at point: CGPoint, in size: CGSize, quadrant: Quadrant,
                            edgeGrip: CGFloat = edgeGrip, cornerGrip: CGFloat = cornerGrip) -> ResizeEdge? {
        guard (0...size.width).contains(point.x), (0...size.height).contains(point.y) else { return nil }
        let side: ResizeEdge = quadrant.isRight ? .left : .right
        let sideDistance = quadrant.isRight ? point.x : size.width - point.x
        let end: ResizeEdge = quadrant.isTop ? .bottom : .top
        let endDistance = quadrant.isTop ? point.y : size.height - point.y
        if sideDistance < cornerGrip && endDistance < cornerGrip {
            switch (side, end) {
            case (.left, .top): return .topLeft
            case (.left, _): return .bottomLeft
            case (_, .top): return .topRight
            default: return .bottomRight
            }
        }
        if sideDistance < edgeGrip { return side }
        if endDistance < edgeGrip { return end }
        return nil
    }

    /// Which way a window of this width can still be resized: at full size only smaller, at the smallest only bigger.
    public enum ResizeRoom: Equatable { case both, shrinkOnly, growOnly }

    public static func room(width: CGFloat, full: CGSize) -> ResizeRoom {
        if width >= full.width - 0.5 { return .shrinkOnly }
        if width <= minSize(full: full).width + 0.5 { return .growOnly }
        return .both
    }

    /// The window after a resize drag that started at `start` and has moved by
    /// `delta` (AppKit: up is positive). The corner of the window nearest the
    /// screen's corner of its quadrant stays put. A left or right edge changes
    /// the width; a top or bottom edge changes the height and the width
    /// follows at 16:9; a corner takes whichever gives the larger window. The
    /// width is clamped between `minScale` of `full` and all of it, and the height follows at 16:9.
    public static func resize(start: CGRect, quadrant: Quadrant, edge: ResizeEdge,
                              delta: CGVector, full: CGSize) -> CGRect {
        func widthFromHeight(_ height: CGFloat) -> CGFloat { height * 16 / 9 }

        // How far each axis would make the window, measured outward from the dragged edge.
        var fromX: CGFloat?
        var fromY: CGFloat?
        switch edge {
        case .right, .topRight, .bottomRight: fromX = start.width + delta.dx
        case .left, .topLeft, .bottomLeft: fromX = start.width - delta.dx
        default: break
        }
        switch edge {
        case .top, .topLeft, .topRight: fromY = widthFromHeight(start.height + delta.dy)
        case .bottom, .bottomLeft, .bottomRight: fromY = widthFromHeight(start.height - delta.dy)
        default: break
        }
        var width = start.width
        switch (fromX, fromY) {
        case let (x?, y?): width = max(x, y)
        case let (x?, nil): width = x
        case let (nil, y?): width = y
        default: break
        }

        let low = minSize(full: full).width
        width = min(full.width, max(low, width)).rounded()
        let height = (width * 9 / 16).rounded()
        let x = quadrant.isRight ? start.maxX - width : start.minX
        let y = quadrant.isTop ? start.maxY - height : start.minY
        return CGRect(x: x, y: y, width: width, height: height)
    }

    /// The scale a window of this width stands for, clamped to `minScale`...1.
    public static func scale(forWidth width: CGFloat, full: CGSize) -> CGFloat {
        guard full.width > 0 else { return 1 }
        return clamp(width / full.width)
    }
}
