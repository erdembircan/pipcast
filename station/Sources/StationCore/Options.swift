import Foundation

/// The command line, parsed.
public enum Command: Equatable {
    case launch(StationOptions)
    case serve(StationOptions)
    case snapshot(SnapshotOptions)
    case stop(home: String)
    case version
}

/// What `launch` and `serve` take.
public struct StationOptions: Equatable {
    public var home: String
    public var assets: String
    public var targetBundleID: String

    public init(home: String, assets: String, targetBundleID: String = Options.defaultTarget) {
        self.home = home
        self.assets = assets
        self.targetBundleID = targetBundleID
    }
}

/// What `snapshot` takes.
public struct SnapshotOptions: Equatable {
    public var assets: String
    public var input: String
    public var out: String
    public var width: Double

    public init(assets: String, input: String, out: String, width: Double = Options.defaultWidth) {
        self.assets = assets
        self.input = input
        self.out = out
        self.width = width
    }
}

/// A command line that cannot be run. `message` is the reason, exactly.
public struct OptionsError: Error, Equatable {
    public let message: String

    public init(_ message: String) {
        self.message = message
    }
}

public enum Options {
    public static let defaultTarget = Constants.claudeBundleID
    public static let defaultWidth = 716.0
    public static let widthRange = 320.0...1920.0

    public static let usage = """
    usage: pipcast-station launch --home <dir> --assets <dir> [--target-bundle-id <id>]
           pipcast-station serve --home <dir> --assets <dir> [--target-bundle-id <id>]
           pipcast-station snapshot --assets <dir> --input <file> --out <file> [--width <points>]
           pipcast-station stop --home <dir>
           pipcast-station --version
    """

    /// What goes to standard error for a failed parse: the reason, then the usage.
    public static func report(_ error: OptionsError) -> String {
        "pipcast-station: \(error.message)\n\(usage)\n"
    }

    /// Parses the arguments after the executable's name.
    public static func parse(_ arguments: [String]) throws -> Command {
        guard let first = arguments.first else { throw OptionsError("missing command") }
        let rest = Array(arguments.dropFirst())
        switch first {
        case "--version":
            return .version
        case "launch", "serve":
            let values = try collect(rest, allowed: ["--home", "--assets", "--target-bundle-id"])
            guard let home = values["--home"] else { throw OptionsError("missing --home") }
            guard let assets = values["--assets"] else { throw OptionsError("missing --assets") }
            let options = StationOptions(home: home, assets: assets,
                                         targetBundleID: values["--target-bundle-id"] ?? defaultTarget)
            return first == "launch" ? .launch(options) : .serve(options)
        case "snapshot":
            let values = try collect(rest, allowed: ["--assets", "--input", "--out", "--width"])
            guard let assets = values["--assets"] else { throw OptionsError("missing --assets") }
            guard let input = values["--input"] else { throw OptionsError("missing --input") }
            guard let out = values["--out"] else { throw OptionsError("missing --out") }
            var width = defaultWidth
            if let raw = values["--width"] {
                guard let parsed = Double(raw), widthRange.contains(parsed) else {
                    throw OptionsError("--width must be a number from 320 to 1920")
                }
                width = parsed
            }
            return .snapshot(SnapshotOptions(assets: assets, input: input, out: out, width: width))
        case "stop":
            let values = try collect(rest, allowed: ["--home"])
            guard let home = values["--home"] else { throw OptionsError("missing --home") }
            return .stop(home: home)
        default:
            throw OptionsError("unknown command \(first)")
        }
    }

    /// Reads `--name value` pairs. A value is whatever follows its name, even
    /// when it begins with `--`; a repeated option keeps the last value.
    private static func collect(_ arguments: [String], allowed: [String]) throws -> [String: String] {
        var values: [String: String] = [:]
        var index = 0
        while index < arguments.count {
            let name = arguments[index]
            guard allowed.contains(name) else { throw OptionsError("unknown option \(name)") }
            guard index + 1 < arguments.count else { throw OptionsError("\(name) needs a value") }
            values[name] = arguments[index + 1]
            index += 2
        }
        return values
    }
}
