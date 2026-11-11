import Foundation
import Testing
@testable import StationCore

/// The count the station puts in every snapshot, which moves only when what the weather reads of the sessions on air
/// does.
@Suite struct LimitsCounterTests {
    func week(_ percent: Double, at: Double) -> [String: Any] {
        ["kind": "week", "percentUsed": percent, "resetsAt": 1_800_000_000_000.0, "at": at]
    }

    func record(_ id: String, checkedInAt: Double = 1_000, title: String = "t", state: String = "working", limits: [[String: Any]]? = nil) -> RecordFile {
        var json: [String: Any] = [
            "v": 1, "id": id, "title": title, "project": "p", "state": state, "stateAt": 1,
            "tunedInAt": 500, "checkedInAt": checkedInAt, "stories": [], "activity": [], "hours": [],
        ]
        if let limits { json["limits"] = limits }
        guard let data = try? JSONSerialization.data(withJSONObject: json), let record = RecordFile.parse(data) else {
            fatalError("not a record")
        }
        return record
    }

    @Test func startsAtZeroAndStaysThereWithNoOneOnAir() {
        var counter = LimitsCounter()
        #expect(counter.count == 0)
        let raised = counter.update([])
        #expect(!raised)
        #expect(counter.count == 0)
    }

    @Test func risesWhenASessionGoesOnAirAndWhenItGoesOff() {
        var counter = LimitsCounter()
        var raised = counter.update([record("a")])
        #expect(raised)
        #expect(counter.count == 1)
        raised = counter.update([record("a"), record("b")])
        #expect(raised)
        #expect(counter.count == 2)
        raised = counter.update([record("b")])
        #expect(raised)
        #expect(counter.count == 3)
        raised = counter.update([])
        #expect(raised)
        #expect(counter.count == 4)
    }

    @Test func staysWhereItIsForARecordRewrittenWithOnlyItsCheckInChanged() {
        var counter = LimitsCounter()
        let limits = [week(41.5, at: 900)]
        counter.update([record("a", checkedInAt: 1_000, limits: limits)])
        let before = counter.count
        for beat in 1...10 {
            let raised = counter.update([record("a", checkedInAt: 1_000 + Double(beat) * 10_000, limits: limits)])
            #expect(!raised)
        }
        #expect(counter.count == before)
    }

    @Test func staysWhereItIsForAnyOtherFieldThatChanges() {
        var counter = LimitsCounter()
        let limits = [week(41.5, at: 900)]
        counter.update([record("a", limits: limits)])
        let before = counter.count
        let raised = counter.update([record("a", title: "a new title", state: "ready", limits: limits)])
        #expect(!raised)
        #expect(counter.count == before)
    }

    @Test func risesWhenALimitChangesOrComesOrGoes() {
        var counter = LimitsCounter()
        counter.update([record("a")])
        // A reading comes
        var raised = counter.update([record("a", limits: [week(41.5, at: 900)])])
        #expect(raised)
        // The same reading again, the session checking in
        raised = counter.update([record("a", checkedInAt: 11_000, limits: [week(41.5, at: 900)])])
        #expect(!raised)
        // A newer one
        raised = counter.update([record("a", limits: [week(42.5, at: 1_900)])])
        #expect(raised)
        // Another session's reading, with the first unchanged
        raised = counter.update([record("a", limits: [week(42.5, at: 1_900)]), record("b", limits: [week(43, at: 2_000)])])
        #expect(raised)
        // The readings gone
        raised = counter.update([record("a"), record("b")])
        #expect(raised)
        #expect(counter.count == 5)
    }
}
