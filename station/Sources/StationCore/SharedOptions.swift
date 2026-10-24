import Foundation

/// `options.json`: `{ v, transparent, pressedAt? }`, the plugin options the station follows, written by the mods, and
/// by the window's Transparent window button with `pressedAt`, the time of the press, until a session on air saves the
/// value as the plugin's option and writes the file again without it. Reading mirrors the contract's
/// `parseSharedOptions`: anything but a version 1 object with a boolean `transparent` leaves the window solid, and a
/// `pressedAt` that is not a number is no press.
public struct SharedOptions: Equatable {
    public var transparent = false
    public var pressedAt: Double?

    public init(transparent: Bool = false, pressedAt: Double? = nil) {
        self.transparent = transparent
        self.pressedAt = pressedAt
    }

    /// Reads the file's bytes; the defaults when they are not the file.
    public static func parse(_ data: Data) -> SharedOptions {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let json = object as? [String: Any],
              let version = SessionSummary.number(json["v"]), version == 1,
              let value = json["transparent"] as? NSNumber,
              CFGetTypeID(value) == CFBooleanGetTypeID() else { return SharedOptions() }
        return SharedOptions(transparent: value.boolValue, pressedAt: SessionSummary.number(json["pressedAt"]))
    }

    /// The options in a file, or the defaults when it is missing or not the file.
    public static func load(from path: String) -> SharedOptions {
        guard let data = FileManager.default.contents(atPath: path) else { return SharedOptions() }
        return parse(data)
    }

    /// What a press of the Transparent window button writes: the other value, pressed at `now`.
    public func pressed(at now: Double) -> SharedOptions {
        SharedOptions(transparent: !transparent, pressedAt: now)
    }

    /// The file's bytes: `v`, `transparent`, and `pressedAt` when there is a press.
    public func data() throws -> Data {
        var json: [String: Any] = ["v": 1, "transparent": transparent]
        if let pressedAt { json["pressedAt"] = pressedAt }
        return try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }

    /// Writes the file whole through `options.json.tmp`, a name no session writes through.
    public func write(to path: String) throws {
        try writeAtomically(try data(), to: path)
    }
}
