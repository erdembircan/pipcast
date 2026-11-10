import Foundation
import Testing
@testable import PipcastStation
import StationCore

/// The messages the page posts to the station, read as the app reads them.
@Suite struct PageMessageTests {
    func read(_ json: String) -> PageMessage? {
        guard let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) else { return nil }
        return PageMessage(body: object)
    }

    @Test func readsTheWeatherDesksMemory() {
        let message = read(#"{"type":"weather","memory":{"v":1,"resetsAt":1800000000000,"points":[[1799000000000,12.5]],"warnedAt":null}}"#)
        guard case let .weather(memory)? = message else {
            Issue.record("not a weather message: \(String(describing: message))")
            return
        }
        #expect(WeatherMemory(json: memory) == WeatherMemory(resetsAt: 1_800_000_000_000, points: [[1_799_000_000_000, 12.5]], warnedAt: nil))
    }

    @Test func rejectsAWeatherMessageWithNoMemoryOrOneThatIsNotTheFile() {
        #expect(read(#"{"type":"weather"}"#) == nil)
        #expect(read(#"{"type":"weather","memory":"soon"}"#) == nil)
        #expect(read(#"{"type":"weather","memory":[]}"#) == nil)
        #expect(read(#"{"type":"weather","memory":{"v":2,"points":[]}}"#) == nil)
        #expect(read(#"{"type":"weather","memory":{"points":[]}}"#) == nil)
    }

    @Test func stillReadsTheMessagesItAlwaysDid() {
        guard case .ready? = read(#"{"type":"ready"}"#) else {
            Issue.record("ready was not read")
            return
        }
        guard case let .cue(jingle)? = read(#"{"type":"cue","jingle":"weather-alert"}"#) else {
            Issue.record("the new jingle's cue was not read")
            return
        }
        #expect(jingle == "weather-alert")
        #expect(read(#"{"type":"cue","jingle":"no-such"}"#) == nil)
        #expect(read(#"{"type":"fly"}"#) == nil)
    }
}
