import Foundation

/// `options.json`: `{ v, transparent, oldTv }`, the plugin options the station follows, written by the mods. Reading
/// mirrors the contract's `parseSharedOptions`: anything but a version 1 object with a boolean `transparent` leaves
/// the window solid, and an `oldTv` that is missing or not a boolean reads as off.
public struct SharedOptions: Equatable {
    public var transparent = false
    public var oldTV = false

    public init(transparent: Bool = false, oldTV: Bool = false) {
        self.transparent = transparent
        self.oldTV = oldTV
    }

    /// Reads the file's bytes; the defaults when they are not the file.
    public static func parse(_ data: Data) -> SharedOptions {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let json = object as? [String: Any],
              let version = SessionSummary.number(json["v"]), version == 1,
              let value = json["transparent"] as? NSNumber,
              CFGetTypeID(value) == CFBooleanGetTypeID() else { return SharedOptions() }
        var oldTV = false
        if let tv = json["oldTv"] as? NSNumber, CFGetTypeID(tv) == CFBooleanGetTypeID() {
            oldTV = tv.boolValue
        }
        return SharedOptions(transparent: value.boolValue, oldTV: oldTV)
    }

    /// The options in a file, or the defaults when it is missing or not the file.
    public static func load(from path: String) -> SharedOptions {
        guard let data = FileManager.default.contents(atPath: path) else { return SharedOptions() }
        return parse(data)
    }
}
