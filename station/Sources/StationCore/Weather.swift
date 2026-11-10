import Foundation

/// `weather.json`: `{ v, resetsAt, points, warnedAt }`, the week's usage readings the page's forecast goes by and when
/// STORM WARNING last came due. The page owns it and the station only keeps it: it saves what the page sends and sends
/// it back in every snapshot. Reading mirrors the contract's `parseWeather`: anything but a version 1 object is not the
/// file, a reset or warning time that is not a finite number is null, and of the points only those that are two finite
/// numbers are kept, each later than the one before, the percent held to 0...100, the newest `Constants.weatherMaxPoints`.
public struct WeatherMemory: Equatable {
    /// When the week the readings belong to resets, in ms; nil before the first reading.
    public var resetsAt: Double?
    /// `[when in ms, percent of the week used]`, oldest first.
    public var points: [[Double]]
    /// When STORM WARNING last came due, in ms.
    public var warnedAt: Double?

    public init(resetsAt: Double? = nil, points: [[Double]] = [], warnedAt: Double? = nil) {
        self.resetsAt = resetsAt
        self.points = points
        self.warnedAt = warnedAt
    }

    /// Reads a JSON object; nil when it is not a version 1 file.
    public init?(json: [String: Any]) {
        guard let version = SessionSummary.number(json["v"]), version == 1 else { return nil }
        var kept: [[Double]] = []
        for entry in (json["points"] as? [Any]) ?? [] {
            guard let pair = entry as? [Any], pair.count == 2,
                  let at = SessionSummary.number(pair[0]), let percent = SessionSummary.number(pair[1]) else { continue }
            if let last = kept.last, at <= last[0] { continue }
            kept.append([at, min(100, max(0, percent))])
        }
        self.init(resetsAt: SessionSummary.number(json["resetsAt"]),
                  points: Array(kept.suffix(Constants.weatherMaxPoints)),
                  warnedAt: SessionSummary.number(json["warnedAt"]))
    }

    /// The file's object, with an explicit null for each time it has none, as the contract's type has it.
    public var json: [String: Any] {
        [
            "v": 1,
            "resetsAt": resetsAt.map { $0 as Any } ?? NSNull(),
            "points": points,
            "warnedAt": warnedAt.map { $0 as Any } ?? NSNull(),
        ]
    }

    /// The memory in a file; nil when it is missing or not the file.
    public static func load(from path: String) -> WeatherMemory? {
        guard let data = FileManager.default.contents(atPath: path),
              let object = try? JSONSerialization.jsonObject(with: data),
              let json = object as? [String: Any] else { return nil }
        return WeatherMemory(json: json)
    }

    public static func save(_ memory: WeatherMemory, to path: String) throws {
        try writeAtomically(try JSONSerialization.data(withJSONObject: memory.json, options: [.sortedKeys]), to: path)
    }
}
