import CoreGraphics
import Foundation
import Testing
@testable import StationCore

@Suite struct OldTVTests {
    private func bytes(of image: CGImage) throws -> [UInt8] {
        let cfData = try #require(image.dataProvider?.data)
        return Array(UnsafeBufferPointer(start: CFDataGetBytePtr(cfData), count: CFDataGetLength(cfData)))
    }

    @Test func theLinesAreWholePixelsApart() {
        #expect(OldTVLook.linePitch(height: 403, scale: 2) == 1.5)
        #expect(OldTVLook.linePitch(height: 201, scale: 2) == 1)
        #expect(OldTVLook.linePitch(height: 403, scale: 1) == 2)
    }

    @Test func aRandomRunsTheSameFromTheSameSeed() {
        var a = OldTVRandom(seed: 42)
        var b = OldTVRandom(seed: 42)
        #expect((0 ..< 50).map { _ in a.next() } == (0 ..< 50).map { _ in b.next() })
        var c = OldTVRandom(seed: 43)
        var d = OldTVRandom(seed: 42)
        #expect((0 ..< 5).map { _ in c.next() } != (0 ..< 5).map { _ in d.next() })
        var zero = OldTVRandom(seed: 0)
        var replaced = OldTVRandom(seed: 0x9E37_79B9_7F4A_7C15)
        #expect(zero.next() == replaced.next())
        for _ in 0 ..< 1000 {
            let value = a.next()
            #expect(value >= 0 && value < 1)
        }
    }

    @Test func theWobbleHasARowForEachLineWithinTheMap() {
        var random = OldTVRandom(seed: 7)
        let rows = OldTVLook.wobbleRows(count: 403, random: &random)
        #expect(rows.count == 403)
        #expect(rows.allSatisfy { $0 >= -1 && $0 <= 1 })
        #expect(rows.contains { $0 != 0 })
        var again = OldTVRandom(seed: 7)
        #expect(OldTVLook.wobbleRows(count: 403, random: &again) == rows)
    }

    @Test func theBottomTearsOnlyTheLastRows() {
        var random = OldTVRandom(seed: 7)
        let rows = OldTVLook.bottomRows(count: 403, random: &random)
        #expect(rows.count == 403)
        let strip = 14
        #expect(rows.prefix(403 - strip).allSatisfy { $0 == 0 })
        #expect(rows.suffix(strip).contains { $0 != 0 })
        #expect(rows.allSatisfy { $0 >= -1 && $0 <= 1 })
    }

    @Test func aBurstTearsOnlyItsBand() {
        var random = OldTVRandom(seed: 9)
        let rows = OldTVLook.burstRows(count: 403, top: 100, bottom: 132, random: &random)
        #expect(rows.count == 403)
        #expect(rows[..<100].allSatisfy { $0 == 0 })
        #expect(rows[132...].allSatisfy { $0 == 0 })
        #expect(rows[100 ..< 132].contains { $0 != 0 })
        #expect(rows.allSatisfy { $0 >= -1 && $0 <= 1 })
    }

    @Test func aBurstWaitsTwentyToNinetySeconds() {
        var random = OldTVRandom(seed: 11)
        let delays = (0 ..< 1000).map { _ in OldTVLook.nextBurstDelay(random: &random) }
        #expect(delays.allSatisfy { $0 >= 20 && $0 <= 90 })
        #expect(delays.min()! < 25 && delays.max()! > 85)
    }

    @Test func theLoopsHaveTheirFramesAndStayWithinTheirAmplitudes() {
        var random = OldTVRandom(seed: 5)
        let wobble = OldTVLook.wobbleScales(frames: OldTVLook.wobbleFramesA, amplitude: 1.6, random: &random)
        #expect(wobble.count == 97)
        #expect(wobble.contains(0))
        #expect(wobble.contains { $0 > 0 })
        #expect(wobble.allSatisfy { $0 >= 0 && $0 <= 1.6 * 1.2 + 1e-9 })
        let bottom = OldTVLook.bottomScales(frames: OldTVLook.bottomFrames, amplitude: 30, random: &random)
        #expect(bottom.count == 83)
        #expect(bottom.allSatisfy { $0 >= 30 * 0.3 && $0 <= 30 * 1.3 })
        let steps = OldTVLook.burstScales(index: 1, steps: 15, amplitude: 24, random: &random)
        #expect(steps.count == 15)
        // Band 1 tears in steps 4 to 7, and for one step as the burst reaches band 2
        #expect(steps.enumerated().allSatisfy { index, value in
            (4 ... 8).contains(index) ? value >= 12 && value <= 36 : value == 0
        })
    }

    @Test func theLoopsAreTheLengthsTheDocsGive() {
        let loops = [OldTVLook.grainFrames, OldTVLook.chromaFrames, OldTVLook.dropoutFrames, OldTVLook.bottomFrames,
                     OldTVLook.wobbleFramesB, OldTVLook.wobbleFramesA]
        #expect(loops == [24, 29, 41, 83, 89, 97])
    }

    @Test func theRowMapPutsTheTopRowLastAndCarriesTheShiftInRed() throws {
        let image = try #require(OldTVImages.rowMap(rows: [1, 0, -1]))
        #expect(image.width == 4 && image.height == 3)
        let data = try bytes(of: image)
        let red = (0 ..< 3).map { data[$0 * image.bytesPerRow] }
        // The picture's first row is the bottom of what it maps: -1, 0, 1 from the first row down
        #expect(red == [1, 128, 255])
    }

    @Test func theNoiseIsMadeAtTheSizeAsked() throws {
        var random = OldTVRandom(seed: 3)
        let grain = try #require(OldTVImages.grain(width: 32, height: 18, random: &random))
        #expect(grain.width == 32 && grain.height == 18)
        #expect(grain.bitsPerPixel == 16 && grain.bitsPerComponent == 8)
        #expect(grain.colorSpace?.model == .monochrome)
        let colour = try #require(OldTVImages.colourNoise(width: 3, height: 2, random: &random))
        #expect(colour.width == 3 && colour.height == 2 && colour.bitsPerPixel == 32)
        let streaks = try #require(OldTVImages.streaks(width: 64, height: 6, random: &random))
        #expect(streaks.width == 64 && streaks.height == 6)
        #expect(OldTVImages.grain(width: 0, height: 5, random: &random) == nil)
    }

    @Test func grainIsWhiteAboveTheMiddleAndBlackBelowWithAlphaToMatch() throws {
        var random = OldTVRandom(seed: 3)
        let grain = try #require(OldTVImages.grain(width: 40, height: 40, random: &random))
        let data = try bytes(of: grain)
        var white = 0
        var black = 0
        for i in 0 ..< 1600 {
            let gray = data[i * 2], alpha = data[i * 2 + 1]
            #expect(alpha <= 127)
            if gray == 0 { black += 1 } else { white += 1; #expect(gray == alpha) }
        }
        #expect(white > 500 && black > 500)
    }
}
