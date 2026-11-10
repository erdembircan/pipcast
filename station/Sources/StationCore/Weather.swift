import Foundation

/// `weather.json`: `{ v, resetsAt, points, warnedAt }`, the week's usage readings the page's forecast goes by and when
/// STORM WARNING last came due. The page owns it and the station only keeps it: it saves what the page sends and sends
/// it back in the snapshots until the page says it has it (`WeatherHandoff`). Reading mirrors the contract's `parseWeather`: anything but a version 1 object is not the
/// file, a reset or warning time that is not a finite number is null, and of the points only those that are two finite
/// numbers are kept, each later than the one before, the percent held to 0...100, the newest `Constants.weatherMaxPoints`.
/// It does not thin them to the hours: the page's forecast does that, as it takes the memory.
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

/// Whether the page has the weather memory yet. The station puts it in its snapshots from each `ready` until the page
/// says it has it (`weather-taken`): a snapshot that fails to send is covered by the next, and a page that loads again
/// is sent it again.
public struct WeatherHandoff: Equatable {
    public private(set) var taken = false

    public init() {}

    /// The page has loaded, and has no memory yet.
    public mutating func pageLoaded() {
        taken = false
    }

    /// The page has said it has the memory.
    public mutating func pageTook() {
        taken = true
    }

    /// What a snapshot carries for the station's `memory`: `weather`, an explicit null for none, until the page has it;
    /// nothing after.
    public func snapshotEntries(_ memory: WeatherMemory?) -> [String: Any] {
        taken ? [:] : ["weather": memory.map { $0.json as Any } ?? NSNull()]
    }
}
