import CoreGraphics
import Testing
@testable import StationCore

@Suite struct GeometryTests {
    /// The design system's table: visible size, full, smallest.
    static let table: [(CGSize, CGSize, CGSize)] = [
        (CGSize(width: 1280, height: 800), CGSize(width: 600, height: 338), CGSize(width: 420, height: 236)),
        (CGSize(width: 1470, height: 956), CGSize(width: 695, height: 391), CGSize(width: 486, height: 273)),
        (CGSize(width: 1512, height: 982), CGSize(width: 716, height: 403), CGSize(width: 501, height: 282)),
        (CGSize(width: 1728, height: 1117), CGSize(width: 824, height: 464), CGSize(width: 577, height: 325)),
        (CGSize(width: 2560, height: 1440), CGSize(width: 1209, height: 680), CGSize(width: 846, height: 476)),
        (CGSize(width: 3440, height: 1440), CGSize(width: 1209, height: 680), CGSize(width: 846, height: 476)),
    ]

    @Test func fullAndSmallestMatchTheDesignSystemTable() {
        for (visible, full, smallest) in Self.table {
            #expect(Geometry.pipSize(visible: visible) == full, "full on \(visible)")
            #expect(Geometry.minSize(full: full) == smallest, "smallest on \(visible)")
        }
    }

    @Test func eachQuadrantSitsTwentyPointsInFromItsCorner() {
        let visible = CGRect(x: 0, y: 0, width: 1512, height: 982)
        let size = CGSize(width: 716, height: 403)
        #expect(Geometry.frame(quadrant: .bottomRight, scale: 1, visible: visible)
            == CGRect(origin: CGPoint(x: 1512 - 20 - 716, y: 20), size: size))
        #expect(Geometry.frame(quadrant: .bottomLeft, scale: 1, visible: visible)
            == CGRect(origin: CGPoint(x: 20, y: 20), size: size))
        #expect(Geometry.frame(quadrant: .topRight, scale: 1, visible: visible)
            == CGRect(origin: CGPoint(x: 1512 - 20 - 716, y: 982 - 20 - 403), size: size))
        #expect(Geometry.frame(quadrant: .topLeft, scale: 1, visible: visible)
            == CGRect(origin: CGPoint(x: 20, y: 982 - 20 - 403), size: size))
    }

    @Test func quadrantsFollowTheVisibleFrameOfASecondScreen() {
        // A second screen to the right, with a menu bar and Dock trimming its visible frame.
        let visible = CGRect(x: 1512, y: 40, width: 1280, height: 760)
        let full = Geometry.pipSize(visible: visible.size)
        #expect(full == CGSize(width: 600, height: 338))
        let br = Geometry.frame(quadrant: .bottomRight, scale: 1, visible: visible)
        #expect(br == CGRect(x: 1512 + 1280 - 20 - 600, y: 60, width: 600, height: 338))
        let tl = Geometry.frame(quadrant: .topLeft, scale: 1, visible: visible)
        #expect(tl == CGRect(x: 1532, y: 40 + 760 - 20 - 338, width: 600, height: 338))
        let small = Geometry.frame(quadrant: .topRight, scale: 0.7, visible: visible)
        #expect(small.size == CGSize(width: 420, height: 236))
        #expect(small.maxX == visible.maxX - 20)
        #expect(small.maxY == visible.maxY - 20)
    }

    @Test func scaleIsClamped() {
        let visible = CGRect(x: 0, y: 0, width: 1280, height: 800)
        #expect(Geometry.frame(quadrant: .bottomLeft, scale: 0.2, visible: visible).width == 420)
        #expect(Geometry.frame(quadrant: .bottomLeft, scale: 3, visible: visible).width == 600)
    }

    @Test func dividingLinesBelongToTheRightAndToTheTop() {
        let visible = CGRect(x: 1512, y: 40, width: 1280, height: 760)
        let midX = visible.midX, midY = visible.midY
        #expect(Geometry.quadrant(containing: CGPoint(x: midX, y: midY), visible: visible) == .topRight)
        #expect(Geometry.quadrant(containing: CGPoint(x: midX - 0.5, y: midY), visible: visible) == .topLeft)
        #expect(Geometry.quadrant(containing: CGPoint(x: midX, y: midY - 0.5), visible: visible) == .bottomRight)
        #expect(Geometry.quadrant(containing: CGPoint(x: midX - 0.5, y: midY - 0.5), visible: visible) == .bottomLeft)
    }

    @Test func aFrameIsInTheQuadrantThatHoldsItsCentre() {
        let visible = CGRect(x: 0, y: 0, width: 1512, height: 982)
        for quadrant in Quadrant.allCases {
            let frame = Geometry.frame(quadrant: quadrant, scale: 0.85, visible: visible)
            #expect(Geometry.quadrant(containing: CGPoint(x: frame.midX, y: frame.midY), visible: visible) == quadrant)
        }
    }

    // MARK: resize

    let visible = CGRect(x: 1512, y: 0, width: 1512, height: 982)

    @Test func draggingTheLeftEdgeOutwardGrowsTheWindowAndKeepsTheOuterCorner() {
        let full = Geometry.pipSize(visible: visible.size)
        let start = Geometry.frame(quadrant: .bottomRight, scale: 0.8, visible: visible)
        let grown = Geometry.resize(start: start, quadrant: .bottomRight, edge: .left,
                                    delta: CGVector(dx: -30, dy: 0), full: full)
        #expect(grown.width == start.width + 30)
        #expect(grown.height == (grown.width * 9 / 16).rounded())
        #expect(grown.maxX == start.maxX)
        #expect(grown.minY == start.minY)
    }

    @Test func clampingAtTheLargestKeepsTheAnchoredCornerForEveryQuadrant() {
        let full = Geometry.pipSize(visible: visible.size)
        for quadrant in Quadrant.allCases {
            let start = Geometry.frame(quadrant: quadrant, scale: 0.9, visible: visible)
            let edge: ResizeEdge = quadrant.isRight ? .left : .right
            let dx: CGFloat = quadrant.isRight ? -4000 : 4000
            let result = Geometry.resize(start: start, quadrant: quadrant, edge: edge,
                                         delta: CGVector(dx: dx, dy: 0), full: full)
            #expect(result.width == full.width)
            #expect(result.height == (full.width * 9 / 16).rounded())
            #expect(quadrant.isRight ? result.maxX == start.maxX : result.minX == start.minX)
            #expect(quadrant.isTop ? result.maxY == start.maxY : result.minY == start.minY)
        }
    }

    @Test func clampingAtTheSmallestKeepsTheAnchoredCornerForEveryQuadrant() {
        let full = Geometry.pipSize(visible: visible.size)
        let smallest = Geometry.minSize(full: full)
        for quadrant in Quadrant.allCases {
            let start = Geometry.frame(quadrant: quadrant, scale: 1, visible: visible)
            let edge: ResizeEdge = quadrant.isRight ? .left : .right
            let dx: CGFloat = quadrant.isRight ? 4000 : -4000
            let result = Geometry.resize(start: start, quadrant: quadrant, edge: edge,
                                         delta: CGVector(dx: dx, dy: 0), full: full)
            #expect(result.size == smallest)
            #expect(quadrant.isRight ? result.maxX == start.maxX : result.minX == start.minX)
            #expect(quadrant.isTop ? result.maxY == start.maxY : result.minY == start.minY)
        }
    }

    @Test func aTopOrBottomEdgeChangesTheHeightAndTheWidthFollows() {
        let full = Geometry.pipSize(visible: visible.size)
        let start = Geometry.frame(quadrant: .bottomLeft, scale: 0.8, visible: visible)
        // Dragging the top edge down by 30 makes the window 30 shorter.
        let shorter = Geometry.resize(start: start, quadrant: .bottomLeft, edge: .top,
                                      delta: CGVector(dx: 0, dy: -30), full: full)
        let expectedWidth = ((start.height - 30) * 16 / 9)
        #expect(shorter.width == min(full.width, max(Geometry.minSize(full: full).width, expectedWidth)).rounded())
        #expect(shorter.minX == start.minX)
        #expect(shorter.minY == start.minY)
        // Dragging the bottom edge down makes it taller.
        let taller = Geometry.resize(start: start, quadrant: .bottomLeft, edge: .bottom,
                                     delta: CGVector(dx: 0, dy: -20), full: full)
        #expect(taller.width > start.width)
    }

    @Test func aCornerTakesTheLargerOfTheTwo() {
        let full = Geometry.pipSize(visible: visible.size)
        let start = Geometry.frame(quadrant: .topRight, scale: 0.8, visible: visible)
        // The corner away from the anchor is the bottom left one: dragging it left by 10
        // and down by 100 asks for more by height than by width.
        let result = Geometry.resize(start: start, quadrant: .topRight, edge: .bottomLeft,
                                     delta: CGVector(dx: -10, dy: -100), full: full)
        let byHeight = (start.height + 100) * 16 / 9
        #expect(result.width == min(full.width, byHeight).rounded())
        #expect(result.maxX == start.maxX)
        #expect(result.maxY == start.maxY)
    }

    @Test func edgeGripIsEightPointsAndCornersWin() {
        let size = CGSize(width: 600, height: 338)
        #expect(Geometry.edge(at: CGPoint(x: 300, y: 169), in: size) == nil)
        #expect(Geometry.edge(at: CGPoint(x: 7, y: 169), in: size) == .left)
        #expect(Geometry.edge(at: CGPoint(x: 593.5, y: 169), in: size) == .right)
        #expect(Geometry.edge(at: CGPoint(x: 300, y: 3), in: size) == .bottom)
        #expect(Geometry.edge(at: CGPoint(x: 300, y: 335), in: size) == .top)
        #expect(Geometry.edge(at: CGPoint(x: 2, y: 335), in: size) == .topLeft)
        #expect(Geometry.edge(at: CGPoint(x: 598, y: 2), in: size) == .bottomRight)
        #expect(Geometry.edge(at: CGPoint(x: 8, y: 169), in: size) == nil)
    }

    @Test func scaleForAWidthRoundTrips() {
        let full = Geometry.pipSize(visible: visible.size)
        for scale in [0.7, 0.75, 0.9, 1.0] {
            let width = Geometry.scaledSize(full: full, scale: scale).width
            let back = Geometry.scale(forWidth: width, full: full)
            #expect(Geometry.scaledSize(full: full, scale: back).width == width)
        }
    }
}
