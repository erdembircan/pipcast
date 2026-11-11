import CoreGraphics
import Foundation

/// The random numbers Old TV tears the picture with: xorshift64 over a seed, so a look can be checked from one.
public struct OldTVRandom {
    private var state: UInt64

    /// A zero seed would never move, so it is replaced.
    public init(seed: UInt64) {
        state = seed == 0 ? 0x9E37_79B9_7F4A_7C15 : seed
    }

    /// The generator's next state: a seed for another generator, as for one that runs on another queue.
    public mutating func nextSeed() -> UInt64 {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return state
    }

    /// 0 up to, not including, 1.
    public mutating func next() -> Double {
        Double(nextSeed() % 1_000_000) / 1_000_000
    }
}

/// Old TV, the picture as a 1990s broadcast taped and played back on an old television: the numbers it is drawn with,
/// and the rows and amplitudes of the tearing, worked out here so they can be checked. The station draws them
/// (OldTVView).
public enum OldTVLook {
    /// A picture this wide is the size the look is tuned at: everything that is a size scales with width over this.
    public static let referenceWidth: CGFloat = 800
    public static let fps: Double = 30

    // The signal: wobbling lines, the torn bottom edge, then the soft picture
    public static let wobbleAmplitude: Double = 1.6
    public static let wobbleFramesA = 97
    public static let wobbleFramesB = 89
    public static let bottomShare: CGFloat = 0.035
    public static let bottomAmplitude: Double = 30
    public static let bottomFrames = 83
    public static let blurRadius: Double = 1.2
    public static let bloomRadius: Double = 6
    public static let bloomIntensity: Double = 0.15
    public static let saturation: Double = 1.15
    public static let contrast: Double = 0.97
    public static let brightness: Double = 0

    // The tracking burst
    public static let burstBand: Double = 0.08
    public static let burstTravel: Double = 0.16
    public static let burstStartRange: ClosedRange<Double> = 0.15 ... 0.65
    public static let burstSteps = 15
    public static let burstAmplitude: Double = 24
    public static let burstDelay: ClosedRange<Double> = 20 ... 90

    // The noise
    public static let grainOpacity: Float = 0.16
    public static let grainFrames = 24
    public static let chromaOpacity: Float = 0.14
    public static let chromaFrames = 29
    public static let chromaFPS: Double = 15
    public static let chromaDivisor = 10
    public static let dropoutFrames = 41
    public static let dropoutChance = 0.2
    public static let dropoutLength: ClosedRange<Double> = 8.0 ... 58.0
    public static let dropoutOpacity: Float = 0.86

    // The tube
    public static let linesOpacity: CGFloat = 0.16
    public static let linesPerHeight: CGFloat = 240
    public static let cornersLocations: [CGFloat] = [0, 0.62, 1]
    public static let cornersAlpha: [CGFloat] = [0, 0, 0.42]
    public static let cornersEnd = CGPoint(x: 1.12, y: 1.18)
    public static let rimWidth: CGFloat = 14
    public static let rimShadowOpacity: Float = 0.8
    public static let sheenAlpha: CGFloat = 0.07
    public static let sheenStart = CGPoint(x: 0.1, y: 1)
    public static let sheenEnd = CGPoint(x: 0.45, y: 0.55)

    /// The tube's lines: 240 to the picture's height, each a whole number of pixels (two at least) apart, so none
    /// shimmers. `scale` is the screen's pixels to a point.
    public static func linePitch(height: CGFloat, scale: CGFloat) -> CGFloat {
        max(2, (height / linesPerHeight * scale).rounded()) / scale
    }

    private static func clamp(_ value: Double) -> Double { max(-1, min(1, value)) }

    /// One value per row, top row first, -1...1: neighbouring lines move together, with a step now and then.
    public static func wobbleRows(count: Int, random: inout OldTVRandom) -> [Double] {
        var v = 0.0
        return (0 ..< count).map { _ in
            v = v * 0.82 + (random.next() - 0.5) * 0.9
            if random.next() < 0.02 { v += (random.next() - 0.5) * 1.6 }
            return clamp(v)
        }
    }

    /// The bottom 3.5% of the rows, torn sideways; every row above is 0.
    public static func bottomRows(count: Int, random: inout OldTVRandom) -> [Double] {
        let strip = Int((Double(count) * Double(bottomShare)).rounded())
        var hv = 0.0
        return (0 ..< count).map { y in
            guard y >= count - strip else { return 0 }
            hv = hv * 0.5 + (random.next() - 0.2) * 0.9
            return clamp(0.35 + hv + Double(y - (count - strip)) / Double(strip) * 0.5)
        }
    }

    /// The wobble's strength in each frame of its loop: nothing in half of them.
    public static func wobbleScales(frames: Int, amplitude: Double, random: inout OldTVRandom) -> [Double] {
        (0 ..< frames).map { _ in random.next() < 0.5 ? amplitude * (0.4 + random.next() * 0.8) : 0 }
    }

    /// The bottom tear's strength in each frame of its loop.
    public static func bottomScales(frames: Int, amplitude: Double, random: inout OldTVRandom) -> [Double] {
        (0 ..< frames).map { _ in amplitude * (0.3 + random.next()) }
    }

    /// One band of a tracking burst: torn rows from `top` up to, not including, `bottom`, calmer at the band's edges;
    /// every other row is 0.
    public static func burstRows(count: Int, top: Int, bottom: Int, random: inout OldTVRandom) -> [Double] {
        var v = 0.0
        return (0 ..< count).map { y in
            guard y >= top && y < bottom else { return 0 }
            v = v * 0.4 + (random.next() - 0.5) * 2
            let edge = min(Double(y - top), Double(bottom - y)) / Double(bottom - top) * 4
            return clamp(v * min(1, edge + 0.3))
        }
    }

    /// Band `index` of a burst, in each of its steps: the band tears while the burst is on it, and for one step as it
    /// reaches the next.
    public static func burstScales(index: Int, steps: Int, amplitude: Double, random: inout OldTVRandom) -> [Double] {
        (0 ..< steps).map { step in
            (step / 4 == index || (step / 4 == index + 1 && step % 4 == 0)) ? amplitude * (0.5 + random.next()) : 0
        }
    }

    /// Seconds to the next burst: any time from 20 to 90.
    public static func nextBurstDelay(random: inout OldTVRandom) -> Double {
        burstDelay.lowerBound + random.next() * (burstDelay.upperBound - burstDelay.lowerBound)
    }
}

/// The pictures Old TV lays over the window, made without a window.
public enum OldTVImages {
    private static func image(width: Int, height: Int, gray: Bool, fill: (inout [UInt8]) -> Void) -> CGImage? {
        guard width > 0, height > 0 else { return nil }
        let bytesPerPixel = gray ? 2 : 4
        var data = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
        fill(&data)
        return data.withUnsafeMutableBytes { bytes in
            CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8,
                      bytesPerRow: width * bytesPerPixel,
                      space: gray ? CGColorSpaceCreateDeviceGray() : CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)?.makeImage()
        }
    }

    /// A displacement map: 4 points wide, a row to each of `rows` (the top row first), red carrying the sideways
    /// shift as 128 + v * 127. A picture's first row is the bottom of what it maps, so the rows go in reversed.
    public static func rowMap(rows: [Double]) -> CGImage? {
        let height = rows.count
        return image(width: 4, height: height, gray: false) { data in
            for y in 0 ..< height {
                let red = UInt8(max(0, min(255, 128 + rows[height - 1 - y] * 127)))
                for x in 0 ..< 4 {
                    let i = (y * 4 + x) * 4
                    data[i] = red
                    data[i + 1] = 128
                    data[i + 2] = 128
                    data[i + 3] = 255
                }
            }
        }
    }

    /// Film grain, gray with alpha, one value to a pixel: half of the values bright, half dark, the more so the
    /// further from the middle.
    public static func grain(width: Int, height: Int, random: inout OldTVRandom) -> CGImage? {
        image(width: width, height: height, gray: true) { data in
            for i in 0 ..< width * height {
                let v = random.next() - 0.5
                let a = UInt8(min(255, abs(v) * 2 * 255 * 0.5))
                data[i * 2] = v > 0 ? a : 0
                data[i * 2 + 1] = a
            }
        }
    }

    /// Colour noise: opaque colours at random, one to a pixel; the station draws it at a tenth of the size and
    /// stretches it.
    public static func colourNoise(width: Int, height: Int, random: inout OldTVRandom) -> CGImage? {
        image(width: width, height: height, gray: false) { data in
            for i in 0 ..< width * height {
                data[i * 4] = UInt8(random.next() * 255)
                data[i * 4 + 1] = UInt8(random.next() * 255)
                data[i * 4 + 2] = UInt8(random.next() * 255)
                data[i * 4 + 3] = 255
            }
        }
    }

    /// The bright streaks that ride with a burst's band: runs of 4 to 64 pixels, lit or clear.
    public static func streaks(width: Int, height: Int, random: inout OldTVRandom) -> CGImage? {
        image(width: width, height: height, gray: false) { data in
            var run = 0
            var lit = false
            for i in 0 ..< width * height {
                if run <= 0 {
                    lit = random.next() < 0.18
                    run = Int(4 + random.next() * 60)
                }
                run -= 1
                guard lit else { continue }
                // Premultiplied: each colour is its value times the alpha
                let alpha = Double(UInt8(90 + random.next() * 120))
                data[i * 4] = UInt8((230 * alpha / 255).rounded())
                data[i * 4 + 1] = UInt8((230 * alpha / 255).rounded())
                data[i * 4 + 2] = UInt8((240 * alpha / 255).rounded())
                data[i * 4 + 3] = UInt8(alpha)
            }
        }
    }
}
