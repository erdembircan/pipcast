import Foundation

/// `options.json`: `{ v, transparent }`, the plugin options the station follows, written by the mods. Reading
/// mirrors the contract's `parseSharedOptions`: anything but a version 1 object with a boolean `transparent` leaves
/// the window solid.
public struct SharedOptions: Equatable {
    public var transparent = false

    public init(transparent: Bool = false) {
        self.transparent = transparent
    }

    /// Reads the file's bytes; the defaults when they are not the file.
    public static func parse(_ data: Data) -> SharedOptions {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let json = object as? [String: Any],
              let version = SessionSummary.number(json["v"]), version == 1,
              let value = json["transparent"] as? NSNumber,
              CFGetTypeID(value) == CFBooleanGetTypeID() else { return SharedOptions() }
        return SharedOptions(transparent: value.boolValue)
    }

    /// The options in a file, or the defaults when it is missing or not the file.
    public static func load(from path: String) -> SharedOptions {
        guard let data = FileManager.default.contents(atPath: path) else { return SharedOptions() }
        return parse(data)
    }
}
