import AVFoundation
import Foundation

/// The clock the desk runs on, in milliseconds, and how to tell a player when
/// a moment on it is.
public protocol SoundClock: AnyObject {
    func now() -> Double
    func time(_ ms: Double, for player: AVAudioPlayerNode) -> AVAudioTime
    /// The player has just started to play, afresh or again after a stop.
    func started(_ player: AVAudioPlayerNode)
}

/// The station's: the wall clock, handed to players as host time, which a
/// player takes whatever its own timeline says.
public final class HostClock: SoundClock {
    public init() {}

    public func now() -> Double { Date().timeIntervalSince1970 * 1000 }

    public func time(_ ms: Double, for player: AVAudioPlayerNode) -> AVAudioTime {
        let wall = now()
        let host = mach_absolute_time()
        return AVAudioTime(hostTime: host + AVAudioTime.hostTime(forSeconds: max(0, ms - wall) / 1000))
    }

    public func started(_ player: AVAudioPlayerNode) {}
}

/// The checks': the frames an engine in manual rendering mode has rendered,
/// counted from `origin`. Add to `frames` after each render. The players play
/// at the render's rate. A player's own timeline starts at the frame it
/// started on, which this clock keeps for itself: right after a player starts
/// again, the engine's own conversion is a render behind.
public final class RenderClock: SoundClock {
    public let origin: Double
    public let rate: Double
    public var frames: AVAudioFramePosition = 0
    private var starts: [ObjectIdentifier: AVAudioFramePosition] = [:]

    public init(origin: Double, rate: Double) {
        self.origin = origin
        self.rate = rate
    }

    public func now() -> Double { origin + Double(frames) / rate * 1000 }

    public func time(_ ms: Double, for player: AVAudioPlayerNode) -> AVAudioTime {
        let frame = AVAudioFramePosition(((ms - origin) / 1000 * rate).rounded())
        return AVAudioTime(sampleTime: frame - (starts[ObjectIdentifier(player)] ?? 0), atRate: rate)
    }

    public func started(_ player: AVAudioPlayerNode) {
        starts[ObjectIdentifier(player)] = frames
    }
}
