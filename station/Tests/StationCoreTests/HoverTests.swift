import CoreGraphics
import Foundation
import Testing
@testable import StationCore

@Suite struct HoverTests {
    let frame = CGRect(x: 100, y: 50, width: 716, height: 403)

    @Test func thePointerOnTheWindowHoversIt() {
        #expect(isHovered(pointer: CGPoint(x: 400, y: 200), frame: frame, pressing: false))
        #expect(isHovered(pointer: CGPoint(x: 100, y: 50), frame: frame, pressing: false))
    }

    @Test func thePointerElsewhereDoesNot() {
        #expect(!isHovered(pointer: CGPoint(x: 99, y: 200), frame: frame, pressing: false))
        #expect(!isHovered(pointer: CGPoint(x: 816, y: 200), frame: frame, pressing: false))
        #expect(!isHovered(pointer: CGPoint(x: 400, y: 453), frame: frame, pressing: false))
    }

    @Test func aPressHeldKeepsItHoveredOffItsEdge() {
        #expect(isHovered(pointer: CGPoint(x: 2000, y: 2000), frame: frame, pressing: true))
    }

    @Test func theWindowIsWholeUnlessTransparentAndNotHovered() {
        #expect(windowAlpha(transparent: false, hovered: false) == 1)
        #expect(windowAlpha(transparent: false, hovered: true) == 1)
        #expect(windowAlpha(transparent: true, hovered: true) == 1)
        #expect(windowAlpha(transparent: true, hovered: false) == fadedAlpha)
        #expect(fadedAlpha == 0.4)
    }

    @Test func theFadedOpacityIsTheDesignsPipFaded() throws {
        let url = ConstantsTests.repository.appendingPathComponent("design/tokens.json")
        let tokens = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        let frame = (tokens?["frame"] as? [String: Any])?["tokens"] as? [[String: Any]] ?? []
        let value = frame.first { $0["name"] as? String == "pip-faded" }?["value"] as? String
        #expect(value == "\(Int((fadedAlpha * 100).rounded()))%")
    }
}
