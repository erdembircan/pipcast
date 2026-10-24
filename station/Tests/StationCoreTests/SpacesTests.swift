import Foundation
import Testing
@testable import StationCore

@Suite struct SpacesTests {
    static let claude = 1244
    static let safari = 1142

    /// A full-screen Space as the window server lists it, with one tile for each process.
    static func fullScreen(_ id: Int, tiles: [Int]) -> [String: Any] {
        let tileSpaces: [[String: Any]] = tiles.enumerated().map { index, pid in
            ["ManagedSpaceID": id, "id64": id + 2 + index, "type": 5, "pid": pid, "TileWindowID": 67 + index]
        }
        return ["ManagedSpaceID": id, "id64": id, "type": 4, "pid": tiles.first ?? 0,
                "TileLayoutManager": ["TileSpaces": tileSpaces] as [String: Any]]
    }

    static func desktop(_ id: Int) -> [String: Any] {
        ["ManagedSpaceID": id, "id64": id, "type": 0]
    }

    static func display(_ spaces: [[String: Any]]) -> [String: Any] {
        ["Display Identifier": "37D8832A-2D66-02CA-B9F7-8F30A301B230", "Spaces": spaces]
    }

    /// The Mac's one display on 24 October 2026: desktop 1, Claude in full screen on Space 51, desktop 7.
    static let mac = [display([desktop(1), fullScreen(51, tiles: [claude]), desktop(7)])]

    @Test func findsClaudesOwnFullScreenSpace() {
        #expect(Spaces.ownFullScreen(in: Self.mac, pids: [Self.claude]) == [51])
    }

    @Test func desktopsAreNobodysOwn() {
        let displays = [Self.display([Self.desktop(1), Self.desktop(7)])]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]).isEmpty)
    }

    @Test func anotherAppsFullScreenSpaceIsNotClaudes() {
        let displays = [Self.display([Self.desktop(1), Self.fullScreen(60, tiles: [Self.safari])])]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]).isEmpty)
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.safari]) == [60])
    }

    @Test func aSpaceSharedInSplitViewIsNotClaudesOwn() {
        let displays = [Self.display([Self.fullScreen(62, tiles: [Self.claude, Self.safari])])]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]).isEmpty)
    }

    @Test func twoClaudeWindowsInSplitViewAreClaudesOwn() {
        let displays = [Self.display([Self.fullScreen(64, tiles: [Self.claude, Self.claude])])]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]) == [64])
    }

    @Test func aSpaceWithNoTilesIsItsOwnPids() {
        let bare: [String: Any] = ["ManagedSpaceID": 70, "type": 4, "pid": Self.claude]
        #expect(Spaces.ownFullScreen(in: [Self.display([bare])], pids: [Self.claude]) == [70])
    }

    @Test func aTileWithNoPidMakesTheSpaceNobodys() {
        var space = Self.fullScreen(66, tiles: [Self.claude])
        let tiles: [[String: Any]] = [["pid": Self.claude], ["TileWindowID": 9]]
        space["TileLayoutManager"] = ["TileSpaces": tiles] as [String: Any]
        #expect(Spaces.ownFullScreen(in: [Self.display([space])], pids: [Self.claude]).isEmpty)
    }

    @Test func readsEveryDisplay() {
        let displays = [Self.display([Self.desktop(1), Self.fullScreen(51, tiles: [Self.claude])]),
                        Self.display([Self.desktop(3), Self.fullScreen(80, tiles: [Self.claude])])]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]) == [51, 80])
    }

    @Test func noProcessesNoSpaces() {
        #expect(Spaces.ownFullScreen(in: Self.mac, pids: []).isEmpty)
    }

    @Test func readsNumbersAsTheWindowServerHoldsThem() {
        let tile: [String: Any] = ["pid": NSNumber(value: Self.claude)]
        let space: [String: Any] = ["ManagedSpaceID": NSNumber(value: 51), "type": NSNumber(value: 4),
                                    "TileLayoutManager": ["TileSpaces": [tile]] as [String: Any]]
        #expect(Spaces.ownFullScreen(in: [Self.display([space])], pids: [Self.claude]) == [51])
    }

    @Test func skipsWhatItCannotRead() {
        let noID: [String: Any] = ["type": 4, "pid": Self.claude]
        let wordType: [String: Any] = ["ManagedSpaceID": 52, "type": "4", "pid": Self.claude]
        let noOwner: [String: Any] = ["ManagedSpaceID": 53, "type": 4]
        let notAList: [String: Any] = ["Spaces": "none"]
        let displays = [Self.display([noID, wordType, noOwner]), notAList]
        #expect(Spaces.ownFullScreen(in: displays, pids: [Self.claude]).isEmpty)
    }
}
