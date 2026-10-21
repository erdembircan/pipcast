import Foundation

/// `prefs.json`: `{ v, sound, quadrant, scale, lastReportAt }`. Reading mirrors
/// the contract's `parsePrefs`: each field that is missing or of the wrong kind
/// keeps its default, the scale is clamped to 0.7...1, and anything else in the
/// file is ignored.
public struct StationPrefs: Codable, Equatable {
    public var v = 1
    public var sound = true
    public var quadrant = Quadrant.bottomRight
    public var scale = 1.0
    public var lastReportAt: Double?

    public init(sound: Bool = true, quadrant: Quadrant = .bottomRight, scale: Double = 1, lastReportAt: Double? = nil) {
        self.sound = sound
        self.quadrant = quadrant
        self.scale = StationPrefs.clamp(scale)
        self.lastReportAt = lastReportAt
    }

    private enum CodingKeys: String, CodingKey {
        case v, sound, quadrant, scale, lastReportAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let sound = try? container.decode(Bool.self, forKey: .sound) { self.sound = sound }
        if let quadrant = try? container.decode(Quadrant.self, forKey: .quadrant) { self.quadrant = quadrant }
        if let scale = try? container.decode(Double.self, forKey: .scale), scale.isFinite {
            self.scale = StationPrefs.clamp(scale)
        }
        if let at = try? container.decode(Double.self, forKey: .lastReportAt), at.isFinite { lastReportAt = at }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(v, forKey: .v)
        try container.encode(sound, forKey: .sound)
        try container.encode(quadrant, forKey: .quadrant)
        try container.encode(scale, forKey: .scale)
        // An explicit null, as the contract's type has it.
        try container.encode(lastReportAt, forKey: .lastReportAt)
    }

    static func clamp(_ scale: Double) -> Double {
        min(1, max(0.7, scale))
    }

    /// The prefs in a file, or the defaults when it is missing or not JSON.
    public static func load(from path: String) -> StationPrefs {
        guard let data = FileManager.default.contents(atPath: path),
              let prefs = try? JSONDecoder().decode(StationPrefs.self, from: data) else { return StationPrefs() }
        return prefs
    }

    public static func save(_ prefs: StationPrefs, to path: String) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try writeAtomically(try encoder.encode(prefs), to: path)
    }
}
