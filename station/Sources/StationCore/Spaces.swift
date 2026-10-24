import Foundation

/// Which Spaces are one app's own, read from the window server's list of every display's Spaces (what
/// `WindowServerSpaces.displays()` returns). Pure, so it is tested on its own.
public enum Spaces {
    /// The window server's type for a full-screen Space. A desktop is 0.
    public static let fullScreenType = 4

    /// The ids of the full-screen Spaces whose every tile belongs to one of `pids`: an app's own full-screen
    /// Spaces. A Space it shares with another app in Split View is not its own, and neither is one whose
    /// owner cannot be read.
    public static func ownFullScreen(in displays: [[String: Any]], pids: Set<Int>) -> [UInt64] {
        guard !pids.isEmpty else { return [] }
        var own: [UInt64] = []
        for display in displays {
            for space in display["Spaces"] as? [[String: Any]] ?? [] {
                guard integer(space["type"]) == fullScreenType,
                      let id = integer(space["ManagedSpaceID"]) ?? integer(space["id64"]), id > 0,
                      let holders = owners(of: space), !holders.isEmpty,
                      holders.allSatisfy(pids.contains) else { continue }
                if !own.contains(UInt64(id)) { own.append(UInt64(id)) }
            }
        }
        return own
    }

    /// The processes a full-screen Space holds: one for each of its tiles, or the Space's own when it lists
    /// no tiles. Nil when a tile names none.
    static func owners(of space: [String: Any]) -> [Int]? {
        let manager = space["TileLayoutManager"] as? [String: Any]
        let tiles = manager?["TileSpaces"] as? [[String: Any]] ?? []
        if tiles.isEmpty { return integer(space["pid"]).map { [$0] } }
        var pids: [Int] = []
        for tile in tiles {
            guard let pid = integer(tile["pid"]) else { return nil }
            pids.append(pid)
        }
        return pids
    }

    /// An integer from the window server's property list, which holds its numbers as NSNumber.
    static func integer(_ value: Any?) -> Int? {
        switch value {
        case let number as Int: return number
        case let number as NSNumber: return number.intValue
        default: return nil
        }
    }
}
