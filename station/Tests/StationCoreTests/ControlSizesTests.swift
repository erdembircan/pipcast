import CoreGraphics
import Testing
@testable import StationCore

@Suite struct ControlSizesTests {
    /// Visible area, then the controls' sizes on it.
    static let table: [(CGSize, ControlSizes)] = [
        (CGSize(width: 1024, height: 640), ControlSizes(button: 29, symbol: 11, inset: 5, handle: CGSize(width: 18, height: 58), chevron: 15)),
        (CGSize(width: 1280, height: 800), ControlSizes(button: 37, symbol: 14, inset: 7, handle: CGSize(width: 23, height: 74), chevron: 18)),
        (CGSize(width: 1512, height: 982), ControlSizes.reference),
        (CGSize(width: 1728, height: 1117), ControlSizes(button: 51, symbol: 20, inset: 9, handle: CGSize(width: 32, height: 101), chevron: 25)),
        (CGSize(width: 3440, height: 1440), ControlSizes(button: 74, symbol: 29, inset: 14, handle: CGSize(width: 47, height: 149), chevron: 37)),
    ]

    @Test func eachScreenGetsTheReferenceSizesInProportionToItsFullWindow() {
        for (visible, sizes) in Self.table {
            #expect(ControlSizes(full: Geometry.pipSize(visible: visible)) == sizes, "on \(visible)")
        }
    }

    @Test func theFourteenInchKeepsTodaysSizes() {
        let sizes = ControlSizes(full: CGSize(width: 716, height: 403))
        #expect(sizes == ControlSizes.reference)
        #expect(sizes.button == 44 && sizes.symbol == 17 && sizes.inset == 8 && sizes.chevron == 22)
        #expect(sizes.handle == CGSize(width: 28, height: 88) && sizes.handleRadius == 14)
    }

    @Test func theButtonsSitWhereChromeViewPutThem() {
        let frames = ControlSizes.reference.buttonFrames(in: CGSize(width: 716, height: 403))
        #expect(frames.close == CGRect(x: 8, y: 351, width: 44, height: 44))
        #expect(frames.sound == CGRect(x: 612, y: 351, width: 44, height: 44))
        #expect(frames.back == CGRect(x: 664, y: 351, width: 44, height: 44))
    }

    /// Screens from 1024 × 640 to 3440 × 1440, less a 32 pt menu bar: in the smallest window the handle's top stays
    /// below close, and in a left quadrant below Back to Claude.
    @Test func inTheSmallestWindowTheHandleStaysClearOfTheButtons() {
        let screens: [CGSize] = [
            CGSize(width: 1024, height: 640), CGSize(width: 1147, height: 745), CGSize(width: 1280, height: 800),
            CGSize(width: 1352, height: 878), CGSize(width: 1440, height: 900), CGSize(width: 1470, height: 956),
            CGSize(width: 1512, height: 982), CGSize(width: 1728, height: 1117), CGSize(width: 1800, height: 1169),
            CGSize(width: 1920, height: 1080), CGSize(width: 2056, height: 1329), CGSize(width: 2560, height: 1440),
            CGSize(width: 3440, height: 1440),
        ]
        for screen in screens {
            let full = Geometry.pipSize(visible: CGSize(width: screen.width, height: screen.height - 32))
            let controls = ControlSizes(full: full)
            let window = CGRect(origin: .zero, size: Geometry.minSize(full: full))
            let buttons = controls.buttonFrames(in: window.size)
            let right = Minimize.handle(on: window, side: .right, controls: controls)
            let left = Minimize.handle(on: window, side: .left, controls: controls)
            #expect(right.maxY <= buttons.close.minY, "close on \(screen)")
            #expect(left.maxY <= buttons.back.minY, "Back to Claude on \(screen)")
        }
    }

    @Test func theHandleAndTheTabTakeTheScreensSizes() {
        let controls = ControlSizes(full: CGSize(width: 600, height: 338))
        let window = CGRect(x: 0, y: 0, width: 300, height: 169)
        #expect(Minimize.handle(on: window, side: .right, controls: controls) == CGRect(x: 7, y: 47.5, width: 23, height: 74))
        #expect(Minimize.handle(on: window, side: .left, controls: controls) == CGRect(x: 270, y: 47.5, width: 23, height: 74))
        let visible = CGRect(x: 0, y: 0, width: 1280, height: 800)
        let rest = Geometry.frame(quadrant: .bottomRight, scale: 0.5, visible: visible)
        let tab = Minimize.tab(rest: rest, visible: visible, side: .right, controls: controls)
        #expect(tab == CGRect(x: 1280 - 23, y: rest.midY - 37, width: 23, height: 74))
    }

    @Test func aSlideIntoTheSideEndsOnTheScreensTab() {
        let controls = ControlSizes(full: CGSize(width: 600, height: 338))
        let visible = CGRect(x: 0, y: 0, width: 1280, height: 800)
        let rest = Geometry.frame(quadrant: .bottomRight, scale: 0.5, visible: visible)
        let slide = Slide(direction: .into, from: rest, rest: rest, visible: visible, side: .right, reduced: false,
                          dockedFrom: 0, handleAlphaFrom: 0, controls: controls)
        #expect(slide.frame(at: slide.duration).handle
            == Minimize.tab(rest: rest, visible: visible, side: .right, controls: controls))
    }
}
