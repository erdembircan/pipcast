import CoreGraphics
import Foundation
import Testing
@testable import StationCore

private let visible = CGRect(x: 0, y: 0, width: 1512, height: 982)
private let restBottomRight = CGRect(x: 776, y: 20, width: 716, height: 403)
private let restTopLeft = CGRect(x: 20, y: 559, width: 716, height: 403)

private func near(_ a: Double, _ b: Double, _ tolerance: Double = 0.01) -> Bool { abs(a - b) <= tolerance }
private func near(_ a: CGFloat, _ b: CGFloat, _ tolerance: CGFloat = 0.05) -> Bool { abs(a - b) <= tolerance }
private func near(_ a: CGRect, _ b: CGRect, _ tolerance: CGFloat = 0.05) -> Bool {
    near(a.minX, b.minX, tolerance) && near(a.minY, b.minY, tolerance)
        && near(a.width, b.width, tolerance) && near(a.height, b.height, tolerance)
}

@Suite struct CubicBezierTests {
    @Test func theListingsRowsLeaving() {
        let curve = Minimize.inCurve
        #expect(curve(0) == 0)
        #expect(curve(1) == 1)
        #expect(near(curve(0.25), 0.07080))
        #expect(near(curve(0.5), 0.5))
        #expect(near(curve(0.75), 0.92920))
    }

    @Test func theLowerThirdsEntrance() {
        let curve = Minimize.outCurve
        #expect(near(curve(0.25), 0.76728))
        #expect(near(curve(0.5), 0.94608))
        #expect(near(curve(0.75), 0.99111))
    }

    @Test func theDock() {
        let curve = Minimize.dockCurve
        #expect(near(curve(0.34375), 0.16233))
        #expect(near(curve(0.71875), 0.90490))
    }

    @Test func clampsTheProgress() {
        #expect(Minimize.inCurve(-1) == 0)
        #expect(Minimize.inCurve(2) == 1)
    }
}

@Suite struct MinimizeGeometryTests {
    @Test func aQuadrantsSideIsItsOwn() {
        #expect(Quadrant.topRight.side == .right)
        #expect(Quadrant.bottomRight.side == .right)
        #expect(Quadrant.topLeft.side == .left)
        #expect(Quadrant.bottomLeft.side == .left)
    }

    @Test func goneHandleAndTabOnTheRight() {
        #expect(near(Minimize.gone(rest: restBottomRight, visible: visible, side: .right),
                     CGRect(x: 1512, y: 20, width: 716, height: 403)))
        #expect(near(Minimize.handle(on: restBottomRight, side: .right), CGRect(x: 784, y: 177.5, width: 28, height: 88)))
        #expect(near(Minimize.tab(rest: restBottomRight, visible: visible, side: .right),
                     CGRect(x: 1484, y: 177.5, width: 28, height: 88)))
    }

    @Test func goneHandleAndTabOnTheLeft() {
        #expect(near(Minimize.gone(rest: restTopLeft, visible: visible, side: .left),
                     CGRect(x: -716, y: 559, width: 716, height: 403)))
        #expect(near(Minimize.handle(on: restTopLeft, side: .left), CGRect(x: 700, y: 716.5, width: 28, height: 88)))
        #expect(near(Minimize.tab(rest: restTopLeft, visible: visible, side: .left),
                     CGRect(x: 0, y: 716.5, width: 28, height: 88)))
    }

    @Test func theHandleNeverGoesPastTheTab() {
        let right = Minimize.tab(rest: restBottomRight, visible: visible, side: .right)
        let gone = Minimize.gone(rest: restBottomRight, visible: visible, side: .right)
        #expect(Minimize.handle(on: gone, side: .right, tab: right).minX == right.minX)
        let left = Minimize.tab(rest: restTopLeft, visible: visible, side: .left)
        let goneLeft = Minimize.gone(rest: restTopLeft, visible: visible, side: .left)
        #expect(Minimize.handle(on: goneLeft, side: .left, tab: left).minX == left.minX)
    }

    @Test func onlyThePartInsideTheVisibleFrameShows() {
        #expect(Minimize.shown(window: CGRect(x: 1400, y: 20, width: 716, height: 403), visible: visible)
                == CGRect(x: 1400, y: 20, width: 112, height: 403))
        #expect(Minimize.shown(window: CGRect(x: 1512, y: 20, width: 716, height: 403), visible: visible) == .zero)
    }

    @Test func aWindowDroppedWithItsCentrePastASideEdgeGoesIntoIt() {
        func dropped(midX: CGFloat) -> CGRect { CGRect(x: midX - 358, y: 100, width: 716, height: 403) }
        #expect(Minimize.side(droppedAt: dropped(midX: 1513), visible: visible) == .right)
        #expect(Minimize.side(droppedAt: dropped(midX: -1), visible: visible) == .left)
        #expect(Minimize.side(droppedAt: dropped(midX: 1000), visible: visible) == nil)
    }
}

@Suite struct MinimizeSideOfTests {
    @Test func theSideIsThatOfTheQuadrantHoldingTheCentre() {
        func window(midX: CGFloat) -> CGRect { CGRect(x: midX - 358, y: 100, width: 716, height: 403) }
        #expect(Minimize.side(of: window(midX: 400), visible: visible) == .left)
        #expect(Minimize.side(of: window(midX: 756), visible: visible) == .right)
        #expect(Minimize.side(of: window(midX: 1100), visible: visible) == .right)
        #expect(Minimize.side(of: window(midX: 1600), visible: visible) == .right)
        #expect(Minimize.side(of: window(midX: -100), visible: visible) == .left)
    }
}

@Suite struct SlideTests {
    func slide(_ direction: Slide.Direction, from: CGRect, rest: CGRect = restBottomRight, side: Side = .right,
               reduced: Bool = false, dockedFrom: Double = 0, handleAlphaFrom: Double = 0) -> Slide {
        Slide(direction: direction, from: from, rest: rest, visible: visible, side: side, reduced: reduced,
              dockedFrom: dockedFrom, handleAlphaFrom: handleAlphaFrom)
    }

    @Test func intoTheRightSide() {
        let into = slide(.into, from: restBottomRight)
        #expect(near(into.frame(at: 0.105).window.minX, 828.11))
        let late = into.frame(at: 0.315)
        #expect(near(late.window.minX, 1459.89))
        #expect(near(late.handle.minX, 1467.89))
        #expect(near(late.docked, 0.16233))
        let end = into.frame(at: 0.42)
        #expect(near(end.window, Minimize.gone(rest: restBottomRight, visible: visible, side: .right)))
        #expect(near(end.handle, Minimize.tab(rest: restBottomRight, visible: visible, side: .right)))
        #expect(near(end.docked, 1))
        #expect(near(into.frame(at: 0.075).handleAlpha, 0.5))
        #expect(near(into.frame(at: 0.15).handleAlpha, 1))
        #expect(into.isDone(at: 0.42))
        #expect(!into.isDone(at: 0.41))
    }

    @Test func outOfTheRightSide() {
        let gone = Minimize.gone(rest: restBottomRight, visible: visible, side: .right)
        let out = slide(.outOf, from: gone, dockedFrom: 1)
        let early = out.frame(at: 0.115)
        #expect(near(early.window.minX, 947.28))
        #expect(near(early.handle.minX, 955.28))
        #expect(near(early.docked, 0.09510))
        let end = out.frame(at: 0.46)
        #expect(near(end.window, restBottomRight))
        #expect(near(end.docked, 0))
        #expect(near(end.handle, Minimize.handle(on: restBottomRight, side: .right)))
        #expect(out.isDone(at: 0.46))
    }

    @Test func intoTheLeftSide() {
        let into = slide(.into, from: restTopLeft, rest: restTopLeft, side: .left)
        let late = into.frame(at: 0.315)
        #expect(near(late.window.minX, 20 - 683.89))
        #expect(near(late.handle.minX, 16.11))
        #expect(near(into.frame(at: 0.42).handle.minX, 0))
    }

    @Test func intoTheSideFromADroppedFrame() {
        let dropped = CGRect(x: 1300, y: 300, width: 716, height: 403)
        let into = slide(.into, from: dropped)
        let middle = into.frame(at: 0.21)
        #expect(near(middle.window.minX, 1406))
        #expect(near(middle.window.minY, 160))
        #expect(near(into.frame(at: 0.42).window, Minimize.gone(rest: restBottomRight, visible: visible, side: .right)))
    }

    @Test func withReduceMotionTheWindowAndTheTabCrossFade() {
        let into = slide(.into, from: restBottomRight, reduced: true)
        let tab = Minimize.tab(rest: restBottomRight, visible: visible, side: .right)
        let half = into.frame(at: 0.1)
        #expect(half.window == restBottomRight)
        #expect(near(half.windowAlpha, 0.5))
        #expect(half.handle == tab)
        #expect(half.docked == 1)
        #expect(near(half.handleAlpha, 0.5))
        #expect(into.isDone(at: 0.2))

        let gone = Minimize.gone(rest: restBottomRight, visible: visible, side: .right)
        let out = slide(.outOf, from: gone, reduced: true, dockedFrom: 1)
        let outHalf = out.frame(at: 0.1)
        #expect(outHalf.window == restBottomRight)
        #expect(near(outHalf.windowAlpha, 0.5))
        #expect(near(outHalf.handleAlpha, 0.5))
        #expect(outHalf.handle == tab)
    }
}

@Suite struct MinimizeModelTests {
    func model(_ mode: WindowMode) -> MinimizeModel {
        var model = MinimizeModel(minimized: mode != .open)
        if mode == .borrowed { _ = model.handle(.wanted(true, hovered: false)) }
        return model
    }

    /// A model in `mode`, after `event`: what it did and what it asks for.
    func run(_ mode: WindowMode, _ event: MinimizeModel.Event, waiting: Bool = false)
        -> (MinimizeModel, [MinimizeModel.Effect]) {
        var model = model(mode)
        if waiting { _ = model.handle(.wanted(false, hovered: true)) }
        let effects = model.handle(event)
        return (model, effects)
    }

    @Test func startsMinimizedOrOpen() {
        #expect(MinimizeModel(minimized: true).mode == .minimized)
        #expect(!MinimizeModel(minimized: true).isOut)
        #expect(MinimizeModel(minimized: false).mode == .open)
        #expect(MinimizeModel(minimized: false).isOut)
        #expect(model(.borrowed).mode == .borrowed)
        #expect(model(.borrowed).isOut)
    }

    @Test func openMinimizes() {
        let (model, effects) = run(.open, .minimize)
        #expect(model.mode == .minimized)
        #expect(effects == [.save(minimized: true), .slideIn])
    }

    @Test func openIgnoresTheRest() {
        for event: MinimizeModel.Event in [.bringBack, .pointerLeft, .hidden, .wanted(true, hovered: false),
                                           .wanted(false, hovered: true), .pageReady(hovered: false)] {
            let (model, effects) = run(.open, event)
            #expect(model.mode == .open)
            #expect(effects == [])
            #expect(!model.waitingForPointer)
        }
    }

    @Test func minimizedIgnoresMinimizePointerLeftAndHidden() {
        for event: MinimizeModel.Event in [.minimize, .pointerLeft, .hidden] {
            let (model, effects) = run(.minimized, event)
            #expect(model.mode == .minimized)
            #expect(effects == [])
        }
    }

    @Test func minimizedBringsBack() {
        let (model, effects) = run(.minimized, .bringBack)
        #expect(model.mode == .open)
        #expect(effects == [.save(minimized: false), .slideOut])
    }

    @Test func minimizedComesOutForASegment() {
        for hovered in [false, true] {
            let (model, effects) = run(.minimized, .wanted(true, hovered: hovered))
            #expect(model.mode == .borrowed)
            #expect(model.wanted)
            #expect(effects == [.slideOut])
        }
    }

    @Test func minimizedStaysWhenTheWindowIsNotWanted() {
        for event: MinimizeModel.Event in [.wanted(false, hovered: false), .wanted(false, hovered: true),
                                           .pageReady(hovered: false), .pageReady(hovered: true)] {
            let (model, effects) = run(.minimized, event)
            #expect(model.mode == .minimized)
            #expect(!model.wanted)
            #expect(effects == [])
        }
    }

    @Test func borrowedMinimizesAtOnce() {
        let (model, effects) = run(.borrowed, .minimize, waiting: true)
        #expect(model.mode == .minimized)
        #expect(effects == [.slideIn])
        #expect(!model.waitingForPointer)
    }

    @Test func borrowedIgnoresBringBack() {
        let (model, effects) = run(.borrowed, .bringBack)
        #expect(model.mode == .borrowed)
        #expect(effects == [])
    }

    @Test func borrowedStaysWhenAnotherSegmentIsWanted() {
        let (model, effects) = run(.borrowed, .wanted(true, hovered: true), waiting: true)
        #expect(model.mode == .borrowed)
        #expect(effects == [])
        #expect(!model.waitingForPointer)
        #expect(model.wanted)
    }

    @Test func borrowedGoesBackWhenNotWantedAndThePointerIsElsewhere() {
        for event: MinimizeModel.Event in [.wanted(false, hovered: false), .pageReady(hovered: false)] {
            let (model, effects) = run(.borrowed, event)
            #expect(model.mode == .minimized)
            #expect(effects == [.slideIn])
            #expect(!model.wanted)
            #expect(!model.waitingForPointer)
        }
    }

    @Test func borrowedWaitsForThePointerToLeave() {
        for event: MinimizeModel.Event in [.wanted(false, hovered: true), .pageReady(hovered: true)] {
            let (model, effects) = run(.borrowed, event)
            #expect(model.mode == .borrowed)
            #expect(effects == [])
            #expect(model.waitingForPointer)
            #expect(!model.wanted)
        }
    }

    @Test func borrowedGoesBackOnceThePointerLeaves() {
        let (model, effects) = run(.borrowed, .pointerLeft, waiting: true)
        #expect(model.mode == .minimized)
        #expect(effects == [.slideIn])
        #expect(!model.waitingForPointer)
    }

    @Test func borrowedStaysWhenThePointerLeavesAndNothingWaits() {
        let (model, effects) = run(.borrowed, .pointerLeft)
        #expect(model.mode == .borrowed)
        #expect(effects == [])
        #expect(!model.waitingForPointer)
    }

    @Test func borrowedIsMinimizedAgainWhenItHides() {
        let (model, effects) = run(.borrowed, .hidden, waiting: true)
        #expect(model.mode == .minimized)
        #expect(effects == [.settleIn])
        #expect(!model.waitingForPointer)
    }
}

@Suite struct MinimizeTokensTests {
    func token(_ name: String) throws -> String? {
        let url = ConstantsTests.repository.appendingPathComponent("design/tokens.json")
        let tokens = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        let frame = (tokens?["frame"] as? [String: Any])?["tokens"] as? [[String: Any]] ?? []
        return frame.first { $0["name"] as? String == name }?["value"] as? String
    }

    @Test func theHandleIsTheDesignsSize() throws {
        #expect(try token("pip-handle-width") == "28px")
        #expect(try token("pip-handle-width") == "\(Int(Minimize.handleSize.width))px")
        #expect(try token("pip-handle-height") == "88px")
        #expect(try token("pip-handle-height") == "\(Int(Minimize.handleSize.height))px")
    }

    @Test func theTabIsTheDesignsDark() throws {
        #expect(try token("pip-tab-dark") == "55%")
        #expect(try token("pip-tab-dark") == "\(Int((Minimize.tabDark * 100).rounded()))%")
    }
}
