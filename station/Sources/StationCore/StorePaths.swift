import Foundation

/// Where the store keeps each file, mirrored from plugin/src/contract/paths.ts.
/// `root` is the store's folder: ~/Library/Application Support/Pipcast, or the
/// folder given with --home.
public struct StorePaths: Equatable {
    public let root: String
    public let sessions: String
    public let station: String
    public let control: String
    public let prefs: String
    public let options: String
    public let lock: String
    public let log: String

    public init(home: String) {
        var root = home
        while root.hasSuffix("/") { root.removeLast() }
        self.root = root
        sessions = "\(root)/sessions"
        station = "\(root)/station.json"
        control = "\(root)/control.json"
        prefs = "\(root)/prefs.json"
        options = "\(root)/options.json"
        lock = "\(root)/station.lock"
        log = "\(root)/station.log"
    }

    public func session(_ id: String) -> String {
        "\(sessions)/\(id).json"
    }

    public static func defaultHome(userHome: String = NSHomeDirectory()) -> String {
        var home = userHome
        while home.hasSuffix("/") { home.removeLast() }
        return "\(home)/Library/Application Support/\(Constants.storeFolder)"
    }
}
