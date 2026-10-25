// The numbers every part agrees on, mirrored from packages/contract/src/constants.ts
// (and the one clock-skew allowance in validate.ts). A test reads those files and
// fails when any of these differ. Times are in milliseconds.

public enum Constants {
    public static let version = "0.1.0"

    public static let schemaVersion = 1

    // On air
    public static let heartbeatMs: Double = 10_000
    public static let staleMs: Double = 45_000
    /// How far ahead of now a check-in may be before it is not believed (validate.ts).
    public static let clockSkewMs: Double = 5_000

    // The station
    public static let stationHeartbeatMs: Double = 5_000
    public static let stationStaleMs: Double = 20_000
    public static let stationEmptyGraceMs: Double = 5_000
    public static let stationStartGraceMs: Double = 20_000
    public static let snapshotEveryMs: Double = 1_000

    // The sound: how the beat mixes in and phases out, and how fast a cut fades everything
    public static let bedInMs: Double = 300
    public static let bedOutMs: Double = 500
    public static let hushMs: Double = 80

    // Where things live
    public static let storeFolder = "Pipcast"
    public static let claudeBundleID = "com.anthropic.claudefordesktop"
}
