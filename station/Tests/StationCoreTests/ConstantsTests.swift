import Foundation
import Testing
@testable import StationCore

/// Reads the contract's TypeScript and the plugin's manifest, and fails when a mirrored value differs.
@Suite struct ConstantsTests {
    static let repository = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // StationCoreTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // station
        .deletingLastPathComponent() // repository

    /// `export const NAME = value` (or a plain `const`) → the value's text, with
    /// underscores in numbers and quotes removed.
    static func values(in relativePath: String) throws -> [String: String] {
        let url = repository.appendingPathComponent(relativePath)
        let text = try String(contentsOf: url, encoding: .utf8)
        var found: [String: String] = [:]
        for line in text.split(separator: "\n") {
            let pattern = #"^(?:export )?const ([A-Z][A-Z0-9_]*) = (.+?)\s*$"#
            guard let match = line.range(of: pattern, options: .regularExpression) else { continue }
            let parts = String(line[match])
                .replacingOccurrences(of: "export ", with: "")
                .replacingOccurrences(of: "const ", with: "")
                .components(separatedBy: " = ")
            guard parts.count == 2 else { continue }
            found[parts[0]] = parts[1]
                .replacingOccurrences(of: "_", with: "")
                .replacingOccurrences(of: "'", with: "")
        }
        return found
    }

    @Test func theMirroredNumbersAndNamesEqualTheContract() throws {
        let constants = try Self.values(in: "packages/contract/src/constants.ts")
        let mirrored: [String: String] = [
            "SCHEMA_VERSION": String(Constants.schemaVersion),
            "HEARTBEAT_MS": String(Int(Constants.heartbeatMs)),
            "STALE_MS": String(Int(Constants.staleMs)),
            "STATION_HEARTBEAT_MS": String(Int(Constants.stationHeartbeatMs)),
            "STATION_STALE_MS": String(Int(Constants.stationStaleMs)),
            "STATION_EMPTY_GRACE_MS": String(Int(Constants.stationEmptyGraceMs)),
            "STATION_START_GRACE_MS": String(Int(Constants.stationStartGraceMs)),
            "SNAPSHOT_EVERY_MS": String(Int(Constants.snapshotEveryMs)),
            "BED_IN_MS": String(Int(Constants.bedInMs)),
            "BED_OUT_MS": String(Int(Constants.bedOutMs)),
            "HUSH_MS": String(Int(Constants.hushMs)),
            "MIN_SCALE": String(Constants.minScale),
            "STORE_FOLDER": Constants.storeFolder,
            "CLAUDE_BUNDLE_ID": Constants.claudeBundleID,
        ]
        for (name, value) in mirrored {
            #expect(constants[name] == value, "\(name): contract has \(constants[name] ?? "nothing"), Swift has \(value)")
        }
    }

    @Test func theClockSkewEqualsTheOneInValidate() throws {
        let validate = try Self.values(in: "packages/contract/src/validate.ts")
        #expect(validate["CLOCK_SKEW_MS"] == String(Int(Constants.clockSkewMs)))
    }

    @Test func theVersionIsTheManifests() throws {
        let url = Self.repository.appendingPathComponent("packages/mod/plugin.json")
        let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        #expect(Constants.version == manifest?["version"] as? String)
    }

    @Test func theReaderFindsTheValuesItChecks() throws {
        // Guards the test itself: a reader that found nothing would pass everything.
        let constants = try Self.values(in: "packages/contract/src/constants.ts")
        #expect(constants["STALE_MS"] == "45000")
        #expect(constants["CLAUDE_BUNDLE_ID"] == "com.anthropic.claudefordesktop")
    }
}
