import Foundation

// How the station mixes, as plain functions of how far a fade has gone, from 0
// to 1, so the rules can be checked without an engine.

/// The beat mixing in: rising evenly from silence.
public func mixInGain(_ done: Double) -> Float {
    Float(min(1, max(0, done)))
}

/// The beat phasing out: falling as the square of what is left, fast at first,
/// so it carries into an outro's first chord and is gone before its second.
public func phaseOutGain(_ done: Double) -> Float {
    let left = 1 - min(1, max(0, done))
    return Float(left * left)
}

/// A hush: falling evenly to silence.
public func hushGain(_ done: Double) -> Float {
    Float(1 - min(1, max(0, done)))
}
