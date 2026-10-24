import Foundation
import Testing
@testable import StationCore

func temporaryFolder() -> String {
    let path = NSTemporaryDirectory() + "pipcast-station-tests-\(UUID().uuidString)"
    try! FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    return path
}

func recordJSON(id: String, tunedInAt: Double, checkedInAt: Double, v: Int = 1) -> String {
    """
    {"v":\(v),"id":"\(id)","title":"t","project":"p","state":"working","stateAt":1,\
    "tunedInAt":\(tunedInAt),"checkedInAt":\(checkedInAt),"stories":[],"activity":[],"hours":[]}
    """
}

@Suite struct StorePathsTests {
    @Test func mirrorsThePathsOfTheContract() {
        let paths = StorePaths(home: "/tmp/h/")
        #expect(paths.root == "/tmp/h")
        #expect(paths.sessions == "/tmp/h/sessions")
        #expect(paths.session("abc") == "/tmp/h/sessions/abc.json")
        #expect(paths.station == "/tmp/h/station.json")
        #expect(paths.control == "/tmp/h/control.json")
        #expect(paths.prefs == "/tmp/h/prefs.json")
        #expect(paths.lock == "/tmp/h/station.lock")
        #expect(paths.log == "/tmp/h/station.log")
    }

    @Test func defaultHomeIsUnderApplicationSupport() {
        #expect(StorePaths.defaultHome(userHome: "/Users/x/") == "/Users/x/Library/Application Support/Pipcast")
    }
}

@Suite struct RecordsTests {
    @Test func readsASummaryLeniently() {
        let data = Data(recordJSON(id: "a", tunedInAt: 5, checkedInAt: 9).utf8)
        let record = RecordFile.parse(data)
        #expect(record?.summary == SessionSummary(id: "a", tunedInAt: 5, checkedInAt: 9))
        #expect(record?.json["project"] as? String == "p")
    }

    @Test func skipsWhatLacksTheFieldsOrHasAnotherVersion() {
        #expect(RecordFile.parse(Data(recordJSON(id: "a", tunedInAt: 1, checkedInAt: 1, v: 2).utf8)) == nil)
        #expect(RecordFile.parse(Data(#"{"v":1,"id":"a","tunedInAt":1}"#.utf8)) == nil)
        #expect(RecordFile.parse(Data(#"{"v":1,"id":"","tunedInAt":1,"checkedInAt":1}"#.utf8)) == nil)
        #expect(RecordFile.parse(Data(#"{"v":true,"id":"a","tunedInAt":1,"checkedInAt":1}"#.utf8)) == nil)
        #expect(RecordFile.parse(Data(#"{"v":1,"id":"a","tunedInAt":"1","checkedInAt":1}"#.utf8)) == nil)
        #expect(RecordFile.parse(Data("not json".utf8)) == nil)
        #expect(RecordFile.parse(Data("[]".utf8)) == nil)
    }

    @Test func readsOnlyJSONFilesAndSkipsWhatItCannotParse() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        try recordJSON(id: "a", tunedInAt: 1, checkedInAt: 1).write(toFile: "\(folder)/a.json", atomically: true, encoding: .utf8)
        try recordJSON(id: "b", tunedInAt: 1, checkedInAt: 1).write(toFile: "\(folder)/b.json.tmp", atomically: true, encoding: .utf8)
        try recordJSON(id: "c", tunedInAt: 1, checkedInAt: 1).write(toFile: "\(folder)/c.tmp", atomically: true, encoding: .utf8)
        try "{".write(toFile: "\(folder)/d.json", atomically: true, encoding: .utf8)
        let records = RecordFile.readAll(in: folder)
        #expect(records.map(\.summary.id) == ["a"])
        #expect(RecordFile.readAll(in: "\(folder)/missing").isEmpty)
    }

    @Test func liveMeansCheckedInWithinFortyFiveSeconds() {
        let now = 1_000_000.0
        func summary(_ checkedInAt: Double) -> SessionSummary {
            SessionSummary(id: "a", tunedInAt: 0, checkedInAt: checkedInAt)
        }
        #expect(isLive(summary(now), now: now))
        #expect(isLive(summary(now - 45_000), now: now))
        #expect(!isLive(summary(now - 45_001), now: now))
        #expect(isLive(summary(now + 5_000), now: now))
        #expect(!isLive(summary(now + 5_001), now: now))
    }

    @Test func onAirIsEveryLiveRecordByTunedInThenID() {
        let now = 1_000_000.0
        let live = now - 1_000
        let summaries = [
            SessionSummary(id: "e", tunedInAt: 50, checkedInAt: live),
            SessionSummary(id: "b", tunedInAt: 10, checkedInAt: live),
            SessionSummary(id: "a", tunedInAt: 10, checkedInAt: live),
            SessionSummary(id: "stale", tunedInAt: 1, checkedInAt: now - 60_000),
            SessionSummary(id: "d", tunedInAt: 40, checkedInAt: live),
            SessionSummary(id: "c", tunedInAt: 30, checkedInAt: live),
        ]
        #expect(onAir(summaries, now: now).map(\.id) == ["a", "b", "c", "d", "e"])
    }

    @Test func onAirOverWholeRecordsKeepsTheirJSON() {
        let now = 1_000_000.0
        let one = RecordFile.parse(Data(recordJSON(id: "x", tunedInAt: 2, checkedInAt: now).utf8))!
        let two = RecordFile.parse(Data(recordJSON(id: "y", tunedInAt: 1, checkedInAt: now).utf8))!
        let result = onAir([one, two], now: now)
        #expect(result.map(\.summary.id) == ["y", "x"])
        #expect(result[0].json["id"] as? String == "y")
    }
}

@Suite struct VisibilityTests {
    static let claude = "com.anthropic.claudefordesktop"

    @Test func showsUnlessTheTargetIsFrontmost() {
        #expect(shouldShow(frontmost: "com.apple.Safari", target: Self.claude, onTargetsOwnSpace: false))
        #expect(!shouldShow(frontmost: Self.claude, target: Self.claude, onTargetsOwnSpace: false))
        #expect(shouldShow(frontmost: nil, target: Self.claude, onTargetsOwnSpace: false))
    }

    @Test func hiddenOnTheTargetsOwnFullScreenSpaceWhicheverAppIsFrontmost() {
        #expect(!shouldShow(frontmost: "com.apple.Safari", target: Self.claude, onTargetsOwnSpace: true))
        #expect(!shouldShow(frontmost: nil, target: Self.claude, onTargetsOwnSpace: true))
        #expect(!shouldShow(frontmost: Self.claude, target: Self.claude, onTargetsOwnSpace: true))
    }
}
