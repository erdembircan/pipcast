import CoreGraphics

/// The side of the screen a minimized window goes into: its own quadrant's side.
public enum Side: String, Equatable { case left, right }

extension Quadrant {
    public var side: Side { isRight ? .right : .left }
}

/// A CSS cubic-bezier timing curve, evaluated as browsers do.
public struct CubicBezier: Equatable {
    public let x1, y1, x2, y2: Double

    public init(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) {
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
    }

    /// The eased value at progress `x` (clamped to 0...1). Newton's method on x(t), bisection when it stalls.
    public func callAsFunction(_ x: Double) -> Double {
        let x = min(1, max(0, x))
        if x == 0 || x == 1 { return x }
        let cx = 3 * x1
        let bx = 3 * (x2 - x1) - cx
        let ax = 1 - cx - bx
        let cy = 3 * y1
        let by = 3 * (y2 - y1) - cy
        let ay = 1 - cy - by

        func sampleX(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
        func sampleY(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
        func slopeX(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }

        var t = x
        var solved = false
        for _ in 0..<8 {
            let error = sampleX(t) - x
            if abs(error) < 1e-7 {
                solved = true
                break
            }
            let slope = slopeX(t)
            if abs(slope) < 1e-6 { break }
            t -= error / slope
        }
        if !solved {
            var low = 0.0
            var high = 1.0
            t = x
            for _ in 0..<64 {
                let value = sampleX(t)
                if abs(value - x) < 1e-7 { break }
                if value < x { low = t } else { high = t }
                t = (low + high) / 2
            }
        }
        return sampleY(t)
    }
}

/// The minimize handle and the tab: the design's numbers, and the geometry of the window going into the side of the
/// screen and out of it. All rectangles are AppKit points, origin bottom left, y up; `visible` is a screen's
/// `visibleFrame`.
public enum Minimize {
    public static let handleSize = CGSize(width: 28, height: 88)   // pip-handle-width, pip-handle-height
    public static let handleInset: CGFloat = 8
    public static let handleRadius: CGFloat = 14
    public static let tabDark = 0.55                                // pip-tab-dark
    public static let chevronPointSize: CGFloat = 22
    public static let inDuration = 0.42
    public static let inCurve = CubicBezier(0.65, 0, 0.35, 1)       // the listing's rows leaving
    public static let outDuration = 0.46
    public static let outCurve = CubicBezier(0.2, 0.8, 0.2, 1)      // the lower third's entrance
    public static let dockDuration = 0.16
    public static let dockCurve = CubicBezier(0.65, 0, 0.35, 1)
    public static let handleFadeIn = 0.15                           // the controls' fade in
    public static let reducedDuration = 0.2
    public static let pullDistance: CGFloat = 12
    /// How much of a dragged window must be past a side edge before it goes into that side: a quarter of its width.
    public static let dragShare: CGFloat = 0.25

    /// The window wholly past `side` of the visible frame, at the height it rests at.
    public static func gone(rest: CGRect, visible: CGRect, side: Side) -> CGRect {
        let x = side == .right ? visible.maxX : visible.minX - rest.width
        return CGRect(x: x, y: rest.minY, width: rest.width, height: rest.height)
    }

    /// The handle on a window: the middle of its inner edge, 8 pt in.
    public static func handle(on window: CGRect, side: Side) -> CGRect {
        let x = side == .right ? window.minX + handleInset : window.maxX - handleInset - handleSize.width
        return CGRect(x: x, y: window.midY - handleSize.height / 2, width: handleSize.width, height: handleSize.height)
    }

    /// The tab: flat against the visible frame's `side`, level with the middle of where the window rests.
    public static func tab(rest: CGRect, visible: CGRect, side: Side) -> CGRect {
        let x = side == .right ? visible.maxX - handleSize.width : visible.minX
        return CGRect(x: x, y: rest.midY - handleSize.height / 2, width: handleSize.width, height: handleSize.height)
    }

    /// The handle with the window at `window`, never past the tab.
    public static func handle(on window: CGRect, side: Side, tab: CGRect) -> CGRect {
        var frame = handle(on: window, side: side)
        frame.origin.x = side == .right ? min(frame.minX, tab.minX) : max(frame.minX, tab.minX)
        return frame
    }

    /// The part of the window inside the visible frame, the only part that shows. `.zero` when none.
    public static func shown(window: CGRect, visible: CGRect) -> CGRect {
        let part = window.intersection(visible)
        if part.isNull || part.width <= 0 || part.height <= 0 { return .zero }
        return part
    }

    /// The side a dragged window goes into: the left or right edge of `visible` that a quarter of the window is past,
    /// when no other screen lies beyond that edge of `screen` at the window's height. Nil otherwise. `others` are the
    /// frames of every other screen.
    public static func side(dragged window: CGRect, visible: CGRect, screen: CGRect, others: [CGRect]) -> Side? {
        let need = window.width * dragShare
        func level(_ frame: CGRect) -> Bool { frame.maxY > window.minY && frame.minY < window.maxY }
        if window.maxX - visible.maxX >= need, !others.contains(where: { $0.minX >= screen.maxX - 1 && level($0) }) {
            return .right
        }
        if visible.minX - window.minX >= need, !others.contains(where: { $0.maxX <= screen.minX + 1 && level($0) }) {
            return .left
        }
        return nil
    }

    /// The side a window would go into from where it is now: the side of the quadrant that holds its centre, as a
    /// drop there would place it. A centre past either side edge counts for that side.
    public static func side(of window: CGRect, visible: CGRect) -> Side {
        Geometry.quadrant(containing: CGPoint(x: window.midX, y: window.midY), visible: visible).side
    }
}

/// One moment of a slide.
public struct SlideFrame: Equatable {
    /// Where the whole window is (part of it may be past the edge).
    public var window: CGRect
    public var windowAlpha: Double
    public var handle: CGRect
    /// 0 = on the window, 1 = the tab at the edge.
    public var docked: Double
    public var handleAlpha: Double
}

/// One move of the window into the side of the screen or out of it.
public struct Slide: Equatable {
    public enum Direction: Equatable { case into, outOf }

    public let direction: Direction
    /// The window's frame as the slide starts.
    public let from: CGRect
    /// Its place in its quadrant.
    public let rest: CGRect
    public let visible: CGRect
    public let side: Side
    /// Reduce motion: a cross-fade.
    public let reduced: Bool
    public let dockedFrom: Double
    public let handleAlphaFrom: Double

    public init(direction: Direction, from: CGRect, rest: CGRect, visible: CGRect, side: Side, reduced: Bool,
                dockedFrom: Double, handleAlphaFrom: Double) {
        self.direction = direction
        self.from = from
        self.rest = rest
        self.visible = visible
        self.side = side
        self.reduced = reduced
        self.dockedFrom = dockedFrom
        self.handleAlphaFrom = handleAlphaFrom
    }

    public var duration: Double {
        reduced ? Minimize.reducedDuration : (direction == .into ? Minimize.inDuration : Minimize.outDuration)
    }

    public var to: CGRect {
        direction == .into ? Minimize.gone(rest: rest, visible: visible, side: side) : rest
    }

    public func isDone(at elapsed: Double) -> Bool { elapsed >= duration }

    public func frame(at elapsed: Double) -> SlideFrame {
        let p = min(1, max(0, elapsed / duration))
        let tab = Minimize.tab(rest: rest, visible: visible, side: side)
        let into = direction == .into

        if reduced {
            return SlideFrame(window: into ? from : rest, windowAlpha: into ? 1 - p : p, handle: tab, docked: 1,
                              handleAlpha: into ? p : 1 - p)
        }

        let e = (into ? Minimize.inCurve : Minimize.outCurve)(p)
        let target = to
        let origin = CGPoint(x: from.minX + (target.minX - from.minX) * e, y: from.minY + (target.minY - from.minY) * e)
        let window = CGRect(origin: origin, size: rest.size)
        let handle = Minimize.handle(on: window, side: side, tab: tab)

        if into {
            let dockStart = duration - Minimize.dockDuration
            let docked = elapsed <= dockStart
                ? dockedFrom
                : dockedFrom + (1 - dockedFrom) * Minimize.dockCurve((elapsed - dockStart) / Minimize.dockDuration)
            let handleAlpha = handleAlphaFrom + (1 - handleAlphaFrom) * min(1, elapsed / Minimize.handleFadeIn)
            return SlideFrame(window: window, windowAlpha: 1, handle: handle, docked: docked, handleAlpha: handleAlpha)
        }
        let docked = dockedFrom * (1 - Minimize.dockCurve(min(1, elapsed / Minimize.dockDuration)))
        return SlideFrame(window: window, windowAlpha: 1, handle: handle, docked: docked, handleAlpha: 1)
    }
}

/// Whether the window is open in its quadrant, minimized to the side, or out of it for a segment.
public enum WindowMode: String, Equatable { case open, minimized, borrowed }

/// The decisions about minimizing, with no motion: what an event does to the window's mode, and what the station must
/// do about it.
public struct MinimizeModel: Equatable {
    public private(set) var mode: WindowMode
    public private(set) var wanted = false
    /// A segment ended while the pointer was on the borrowed window: it goes back once the pointer leaves.
    public private(set) var waitingForPointer = false

    public init(minimized: Bool) {
        mode = minimized ? .minimized : .open
    }

    public var isOut: Bool { mode != .minimized }

    public enum Event: Equatable {
        /// The handle pressed, or the window dropped past a side edge.
        case minimize
        /// The tab clicked or pulled.
        case bringBack
        /// The page's `window` message; whether the window counts as hovered now.
        case wanted(Bool, hovered: Bool)
        /// The page (re)loaded: the same as `wanted(false)`.
        case pageReady(hovered: Bool)
        /// The window stopped counting as hovered.
        case pointerLeft
        /// The window hid: Claude is in front.
        case hidden
    }

    public enum Effect: Equatable {
        /// Into the side, from wherever the window is.
        case slideIn
        /// Out to its quadrant, from wherever it is.
        case slideOut
        /// Minimized at once, with no motion: the window is hidden.
        case settleIn
        case save(minimized: Bool)
    }

    public mutating func handle(_ event: Event) -> [Effect] {
        let wasWaiting = waitingForPointer
        waitingForPointer = false

        // What the page wants, and whether the pointer keeps the window until it leaves.
        var wants: (wanted: Bool, hovered: Bool)?
        switch event {
        case let .wanted(value, hovered): wants = (value, hovered)
        case let .pageReady(hovered): wants = (false, hovered)
        default: break
        }
        if let wants { wanted = wants.wanted }

        switch mode {
        case .open:
            if event == .minimize {
                mode = .minimized
                return [.save(minimized: true), .slideIn]
            }
            return []
        case .minimized:
            if event == .bringBack {
                mode = .open
                return [.save(minimized: false), .slideOut]
            }
            if let wants, wants.wanted {
                mode = .borrowed
                return [.slideOut]
            }
            return []
        case .borrowed:
            if event == .minimize {
                mode = .minimized
                return [.slideIn]
            }
            if event == .hidden {
                mode = .minimized
                return [.settleIn]
            }
            if event == .pointerLeft, wasWaiting {
                mode = .minimized
                return [.slideIn]
            }
            if let wants, !wants.wanted {
                if wants.hovered {
                    waitingForPointer = true
                    return []
                }
                mode = .minimized
                return [.slideIn]
            }
            return []
        }
    }
}
