import Foundation
import Testing
@testable import StationCore

/// `weather.json`, as the contract's `parseWeather` reads it.
@Suite struct WeatherTests {
    func memory(_ json: String) -> WeatherMemory? {
        guard let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)), let dictionary = object as? [String: Any] else {
            return nil
        }
        return WeatherMemory(json: dictionary)
    }

    @Test func readsAGoodFileAsItIs() {
        let read = memory(#"{"v":1,"resetsAt":1800000000000,"points":[[1799000000000,12.5],[1799000900000,13]],"warnedAt":1799000500000}"#)
        #expect(read == WeatherMemory(resetsAt: 1_800_000_000_000, points: [[1_799_000_000_000, 12.5], [1_799_000_900_000, 13]], warnedAt: 1_799_000_500_000))
    }

    @Test func isNotTheFileWithoutVersion1() {
        #expect(memory(#"{"v":2,"resetsAt":1,"points":[],"warnedAt":null}"#) == nil)
        #expect(memory(#"{"resetsAt":1,"points":[],"warnedAt":null}"#) == nil)
        #expect(memory(#"{"v":true,"points":[]}"#) == nil)
        #expect(memory(#"{"v":"1","points":[]}"#) == nil)
    }

    @Test func takesNilForATimeThatIsNotAFiniteNumber() {
        #expect(memory(#"{"v":1,"resetsAt":"soon","points":[],"warnedAt":true}"#) == WeatherMemory())
        #expect(memory(#"{"v":1,"points":[]}"#) == WeatherMemory())
        #expect(memory(#"{"v":1,"resetsAt":null,"points":[],"warnedAt":null}"#) == WeatherMemory())
    }

    @Test func keepsOnlyPointsThatAreTwoFiniteNumbersAndHoldsThePercent() {
        let read = memory(#"{"v":1,"points":[[1000,10],[2000],[3000,"x"],[4000,20,1],"no",[5000,true],[6000,150],[7000,-5]]}"#)
        #expect(read?.points == [[1000, 10], [6000, 100], [7000, 0]])
    }

    @Test func dropsAPointNotLaterThanTheOneBefore() {
        let read = memory(#"{"v":1,"points":[[1000,10],[1000,11],[900,12],[2000,13]]}"#)
        #expect(read?.points == [[1000, 10], [2000, 13]])
    }

    @Test func keepsTheNewestPointsWhenThereAreTooMany() {
        let points = (0..<(Constants.weatherMaxPoints + 25)).map { "[\(1000 + $0),50]" }.joined(separator: ",")
        let read = memory(#"{"v":1,"points":["# + points + "]}")
        #expect(read?.points.count == 700)
        #expect(read?.points.first == [1025, 50])
        #expect(read?.points.last == [Double(1000 + 700 + 24), 50])
    }

    @Test func writesAnExplicitNullForATimeItHasNot() {
        let object = WeatherMemory().json
        #expect(object["v"] as? Int == 1)
        #expect(object["resetsAt"] is NSNull)
        #expect(object["warnedAt"] is NSNull)
        #expect((object["points"] as? [[Double]])?.isEmpty == true)
    }

    @Test func savesAndLoadsWhatItWrote() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = StorePaths(home: folder).weather
        let kept = WeatherMemory(resetsAt: 1_800_000_000_000, points: [[1_799_000_000_000, 12.5], [1_799_000_900_000, 13]], warnedAt: nil)
        try WeatherMemory.save(kept, to: path)
        #expect(WeatherMemory.load(from: path) == kept)
        let text = try String(contentsOfFile: path, encoding: .utf8)
        #expect(text.contains("\"warnedAt\":null"))
        // Keys are sorted, as the prefs' are
        #expect(text.range(of: "\"points\"")!.lowerBound < text.range(of: "\"resetsAt\"")!.lowerBound)
        #expect(!FileManager.default.fileExists(atPath: path + ".tmp"))
    }

    @Test func loadsNothingFromAFileThatIsMissingOrNotTheFile() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(atPath: folder) }
        let path = StorePaths(home: folder).weather
        #expect(WeatherMemory.load(from: path) == nil)
        try "not json".write(toFile: path, atomically: true, encoding: .utf8)
        #expect(WeatherMemory.load(from: path) == nil)
        try "[]".write(toFile: path, atomically: true, encoding: .utf8)
        #expect(WeatherMemory.load(from: path) == nil)
        try #"{"v":2}"#.write(toFile: path, atomically: true, encoding: .utf8)
        #expect(WeatherMemory.load(from: path) == nil)
    }
}
