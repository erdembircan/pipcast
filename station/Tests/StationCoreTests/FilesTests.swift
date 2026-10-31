import Foundation
import Testing
@testable import StationCore

@Suite struct PrefsTests {
    @Test func defaultsMatchTheContract() {
        let prefs = StationPrefs()
        #expect(prefs.v == 1)
        #expect(prefs.sound)
        #expect(prefs.quadrant == .bottomRight)
        #expect(prefs.scale == 1)
        #expect(prefs.lastReportAt == nil)
        #expect(!prefs.minimized)
    }

    @Test func aMissingOrUnparseableFileGivesTheDefaults() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        #expect(StationPrefs.load(from: "\(folder)/prefs.json") == StationPrefs())
        try "nope".write(toFile: "\(folder)/prefs.json", atomically: true, encoding: .utf8)
        #expect(StationPrefs.load(from: "\(folder)/prefs.json") == StationPrefs())
        try "[1]".write(toFile: "\(folder)/prefs.json", atomically: true, encoding: .utf8)
        #expect(StationPrefs.load(from: "\(folder)/prefs.json") == StationPrefs())
    }

    @Test func readsFieldByFieldAndClampsTheScale() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/prefs.json"
        try #"{"v":1,"sound":false,"quadrant":"top-left","scale":0.2,"lastReportAt":1700000000000,"extra":3}"#
            .write(toFile: path, atomically: true, encoding: .utf8)
        let prefs = StationPrefs.load(from: path)
        #expect(!prefs.sound)
        #expect(prefs.quadrant == .topLeft)
        #expect(prefs.scale == 0.5)
        #expect(prefs.lastReportAt == 1_700_000_000_000)

        try #"{"sound":"yes","quadrant":"middle","scale":"big","lastReportAt":"x"}"#
            .write(toFile: path, atomically: true, encoding: .utf8)
        #expect(StationPrefs.load(from: path) == StationPrefs())

        try #"{"scale":9}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(StationPrefs.load(from: path).scale == 1)
    }

    @Test func aFileWithoutMinimizedLoadsNotMinimized() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/prefs.json"
        try #"{"v":1,"sound":true,"quadrant":"bottom-right","scale":1,"lastReportAt":null}"#
            .write(toFile: path, atomically: true, encoding: .utf8)
        #expect(!StationPrefs.load(from: path).minimized)
        try #"{"minimized":true}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(StationPrefs.load(from: path).minimized)
        try #"{"minimized":"yes"}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(!StationPrefs.load(from: path).minimized)
    }

    @Test func savesAndReadsBackWithoutLeavingATemporaryFile() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/prefs.json"
        let prefs = StationPrefs(sound: false, quadrant: .topRight, scale: 0.8, lastReportAt: 1_792_599_594_000,
                                minimized: true)
        try StationPrefs.save(prefs, to: path)
        #expect(StationPrefs.load(from: path) == prefs)
        #expect(!FileManager.default.fileExists(atPath: path + ".tmp"))
        let text = try String(contentsOfFile: path, encoding: .utf8)
        #expect(text.contains(#""lastReportAt":1792599594000"#))
        #expect(text.contains(#""quadrant":"top-right""#))
        #expect(text.contains(#""minimized":true"#))
        // A null report time is written as null, as the contract's type has it.
        try StationPrefs.save(StationPrefs(), to: path)
        #expect(try String(contentsOfFile: path, encoding: .utf8).contains(#""lastReportAt":null"#))
    }
}

@Suite struct StationFilesTests {
    @Test func statusRoundTripsInTheContractsShape() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.json"
        let status = StationStatus(pid: 4242, startedAt: 1_792_599_594_000, heartbeatAt: 1_792_599_599_000)
        try status.write(to: path)
        #expect(StationStatus.read(from: path) == status)
        let object = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: path))) as! [String: Any]
        #expect(Set(object.keys) == ["v", "pid", "startedAt", "heartbeatAt", "version"])
        #expect(object["v"] as? Int == 1)
        #expect(object["pid"] as? Int == 4242)
        #expect(object["version"] as? String == Constants.version)
        #expect(!FileManager.default.fileExists(atPath: path + ".tmp"))
        StationStatus.delete(at: path)
        #expect(!FileManager.default.fileExists(atPath: path))
        #expect(StationStatus.read(from: path) == nil)
    }

    @Test func controlIsWrittenAsTheModReadsIt() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/control.json"
        try StationControl(closedAt: 1_792_599_594_123).write(to: path)
        let text = try String(contentsOfFile: path, encoding: .utf8)
        #expect(text.contains(#""v":1"#))
        #expect(text.contains(#""closedAt":1792599594123"#))
        #expect(StationControl.read(from: path)?.closedAt == 1_792_599_594_123)
        StationControl.delete(at: path)
        #expect(!FileManager.default.fileExists(atPath: path))
    }

    @Test func aStatusWithAnotherVersionIsNotRead() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.json"
        try #"{"v":2,"pid":1,"startedAt":1,"heartbeatAt":1,"version":"x"}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(StationStatus.read(from: path) == nil)
    }
}

@Suite struct LockTests {
    @Test func onlyOneHolderAtATime() {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.lock"
        let first = SingletonLock.tryAcquire(path)
        #expect(first != nil)
        #expect(SingletonLock.tryAcquire(path) == nil)
        first?.close()
        let second = SingletonLock.tryAcquire(path)
        #expect(second != nil)
        second?.close()
    }

    @Test func releasedWhenTheLockIsDropped() {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.lock"
        var held = SingletonLock.tryAcquire(path)
        #expect(held != nil)
        held = nil
        #expect(SingletonLock.tryAcquire(path) != nil)
    }
}

@Suite struct LogTests {
    @Test func appendsATimestampedLinePerEvent() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.log"
        let log = StationLog(path: path)
        log.write("start \(Constants.version)")
        log.write("shown")
        let lines = try String(contentsOfFile: path, encoding: .utf8).split(separator: "\n").map(String.init)
        #expect(lines.count == 2)
        #expect(lines[0].hasSuffix(" start \(Constants.version)"))
        #expect(lines[1].hasSuffix(" shown"))
        let stamp = String(lines[0].split(separator: " ")[0])
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        #expect(formatter.date(from: stamp) != nil)
    }

    @Test func isCutToItsLastQuarterMegabyteOncePastOneMegabyte() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/station.log"
        let line = String(repeating: "x", count: 99) + "\n"
        try Data(String(repeating: line, count: 10_100).utf8).write(to: URL(fileURLWithPath: path))
        #expect(try Data(contentsOf: URL(fileURLWithPath: path)).count > StationLog.limit)
        StationLog(path: path).write("after the cut")
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        #expect(data.count <= StationLog.keep + 100)
        #expect(data.count > StationLog.keep - 300)
        let text = String(decoding: data, as: UTF8.self)
        #expect(text.hasSuffix(" after the cut\n"))
        #expect(text.hasPrefix("x"))
        // Every line that survives the cut is whole: the trailing empty piece and the new line aside.
        #expect(text.components(separatedBy: "\n").dropLast(2).allSatisfy { $0.count == 99 })
    }
}

@Suite struct SharedOptionsTests {
    @Test func aMissingOrUnreadableFileLeavesTheWindowSolid() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/options.json"
        #expect(!SharedOptions.load(from: path).transparent)
        for text in ["nope", "[1]", #"{"v":2,"transparent":true}"#, #"{"v":1,"transparent":"yes"}"#, #"{"v":1,"transparent":1}"#, #"{"transparent":true}"#] {
            try text.write(toFile: path, atomically: true, encoding: .utf8)
            #expect(!SharedOptions.load(from: path).transparent, "\(text)")
        }
    }

    @Test func readsTransparentFromVersionOne() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = "\(folder)/options.json"
        try #"{"v":1,"transparent":true,"extra":3}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(SharedOptions.load(from: path).transparent)
        try #"{"v":1,"transparent":false}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(!SharedOptions.load(from: path).transparent)
    }
}
