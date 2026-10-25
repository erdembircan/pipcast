import AVFoundation
import Foundation
import StationCore
import Testing
@testable import StationSound

/// The desk rendering offline, with marker sounds in place of the real ones:
/// each sound is silence but for single frames at known levels, so what each
/// event does can be read off the render to the frame.
@Suite struct SoundDeskTests {
    static let rate = 48_000.0
    /// A turn of the beat, as the score renders it: 43,648 frames.
    static let turnFrames = 43_648
    static var turn: Double { Double(turnFrames) / rate * 1000 }
    /// A sixteenth of the beat: 5,456 frames.
    static var sixteenth: Double { turn / 8 }

    /// The marker files, written once: each jingle a marker at its start, but
    /// the outros, whose marker falls 125 ms in; each loop a strong marker at
    /// its start and a weaker one on every sixteenth after it.
    static let folder: URL = {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("station-sound-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let markers: [String: (frames: Int, at: [(Int, Float)])] = [
            "breaking": (48_000, [(0, 0.5)]),
            "hour": (48_000, [(0, 0.5)]),
            "breaking-out": (48_000, [(6_000, 0.6)]),
            "hour-out": (48_000, [(6_000, 0.6)]),
            "beat-minor": (turnFrames, (0..<8).map { ($0 * 5_456, $0 == 0 ? 0.4 : 0.2) }),
            "beat-major": (turnFrames, (0..<8).map { ($0 * 5_456, $0 == 0 ? 0.4 : 0.2) }),
        ]
        let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
        for (name, sound) in markers {
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(sound.frames))!
            buffer.frameLength = AVAudioFrameCount(sound.frames)
            for (frame, level) in sound.at {
                buffer.floatChannelData![0][frame] = level
                buffer.floatChannelData![1][frame] = level
            }
            let url = folder.appendingPathComponent("\(name).caf")
            let file = try! AVAudioFile(forWriting: url, settings: format.settings, commonFormat: .pcmFormatFloat32, interleaved: false)
            try! file.write(from: buffer)
        }
        return folder
    }()

    /// The marker files, by name, all CAF.
    static func files() -> [String: URL] {
        var files: [String: URL] = [:]
        for name in SoundDesk.jingles + SoundDesk.beds { files[name] = folder.appendingPathComponent("\(name).caf") }
        return files
    }

    /// Renders the desk until `until` ms, 10 ms at a time, running each event as
    /// its time comes and the pump before each 10 ms. Returns every marker
    /// heard, its time in ms and its level, and what the desk logged.
    static func render(until: Double, _ events: [(at: Double, run: (SoundDesk) -> Void)]) throws -> (markers: [(ms: Double, level: Float)], lines: [String]) {
        let engine = AVAudioEngine()
        let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
        try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 480)
        let clock = RenderClock(origin: 0, rate: rate)
        var lines: [String] = []
        let desk = SoundDesk(engine: engine, clock: clock, files: files(), realTime: false, log: { lines.append($0) })
        try engine.start()
        desk.start()
        var pending = events.sorted { $0.at < $1.at }
        let chunk = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 480)!
        var markers: [(ms: Double, level: Float)] = []
        let total = AVAudioFramePosition(until / 1000 * rate)
        while clock.frames < total {
            while let event = pending.first, event.at <= clock.now() {
                event.run(desk)
                pending.removeFirst()
            }
            desk.pump()
            let count = AVAudioFrameCount(min(480, total - clock.frames))
            #expect(try engine.renderOffline(count, to: chunk) == .success)
            for i in 0..<Int(count) where abs(chunk.floatChannelData![0][i]) > 0.001 {
                markers.append((Double(clock.frames + AVAudioFramePosition(i)) / rate * 1000, chunk.floatChannelData![0][i]))
            }
            clock.frames += AVAudioFramePosition(count)
        }
        engine.stop()
        return (markers, lines)
    }

    /// What an event starts, starts this long after it: the engine's lead.
    static var lead: Double { SoundDesk.leadMs }

    /// The level heard at `ms`, to the frame, or 0.
    static func level(_ markers: [(ms: Double, level: Float)], at ms: Double) -> Float {
        markers.first { abs($0.ms - ms) < 0.5 / rate * 1000 }?.level ?? 0
    }

    @Test func aJingleStartsWhenItIsCued() throws {
        let heard = try Self.render(until: 1_000, [(500, { $0.cue("breaking") })])
        #expect(heard.markers.count == 1)
        #expect(Self.level(heard.markers, at: 500 + Self.lead) == 0.5)
    }

    @Test func theBeatLoopsWithoutAGap() throws {
        let downbeat = 1_000 + Self.lead + Constants.bedInMs
        let heard = try Self.render(until: downbeat + 3 * Self.turn, [(1_000, { $0.bedIn("beat-minor") })])
        // The two notes it mixes in on, then every sixteenth of three turns
        #expect(heard.markers.count == 2 + 24)
        for k in 0..<24 {
            #expect(Self.level(heard.markers, at: downbeat + Double(k) * Self.sixteenth) == (k % 8 == 0 ? 0.4 : 0.2))
        }
    }

    @Test func theBeatMixesInOnTheLastNotesOfItsLine() throws {
        let start = 1_000 + Self.lead
        let heard = try Self.render(until: start + Constants.bedInMs + Self.turn, [(1_000, { $0.bedIn("beat-major") })])
        #expect(heard.markers.filter { $0.ms < start }.isEmpty)
        // The end of the turn, rising evenly from silence over the mix-in
        var rising = 0
        for k in 0..<8 {
            let at = Double(k) * Self.sixteenth - (Self.turn - Constants.bedInMs)
            guard at > 0 else { continue }
            rising += 1
            #expect(abs(Self.level(heard.markers, at: start + at) - 0.2 * Float(at / Constants.bedInMs)) < 0.002)
        }
        #expect(rising == 2)
        // and the downbeat at full, as the mix-in ends
        #expect(Self.level(heard.markers, at: start + Constants.bedInMs) == 0.4)
    }

    @Test func theBeatPhasesOutAsTheSquareOfWhatIsLeft() throws {
        let out = 1_000 + 2 * Self.turn + 50
        let heard = try Self.render(until: out + 1_500, [
            (1_000, { $0.bedIn("beat-minor") }),
            (out, { $0.bedOut() }),
        ])
        let going = out + Self.lead
        for marker in heard.markers where marker.ms >= going {
            // the pump sets the level for each 10 ms as it starts
            let done = (marker.ms - going) / Constants.bedOutMs
            let phase = (marker.ms - 1_000 - Self.lead - Constants.bedInMs).truncatingRemainder(dividingBy: Self.turn)
            let base: Float = min(phase, Self.turn - phase) < 0.1 ? 0.4 : 0.2
            #expect(marker.level <= base * phaseOutGain(done - 10 / Constants.bedOutMs) + 0.001)
            #expect(marker.level >= base * phaseOutGain(done) - 0.001)
        }
        #expect(heard.markers.filter { $0.ms >= going + Constants.bedOutMs }.isEmpty)
    }

    @Test func aBeatAfterOneHasGoneMixesInAfresh() throws {
        let again = 3_730.0
        let heard = try Self.render(until: again + Self.turn, [
            (1_000, { $0.bedIn("beat-minor") }),
            (1_000 + Self.turn, { $0.bedOut() }),
            (again, { $0.bedIn("beat-major") }),
        ])
        // Nothing of the first is left; the second mixes in on its own notes and
        // lands its downbeat at full
        #expect(heard.markers.filter { $0.ms >= 1_000 + Self.turn + Self.lead + Constants.bedOutMs && $0.ms < again + Self.lead }.isEmpty)
        #expect(Self.level(heard.markers, at: again + Self.lead + Constants.bedInMs) == 0.4)
        #expect(Self.level(heard.markers, at: again + Self.lead + Constants.bedInMs + Self.sixteenth) == 0.2)
    }

    @Test func aHushFadesEverythingOut() throws {
        let heard = try Self.render(until: 4_000, [
            (0, { $0.bedIn("beat-minor") }),
            (2_000, { $0.hush() }),
            (2_010, { $0.cue("breaking") }),
        ])
        // The jingle cued during the hush ends it at once and starts clean. Its
        // player was stopped and started again in that same moment, and
        // rendering offline the engine starts such a player's timeline one
        // render (10 ms) late; in real time it goes by host time
        #expect(heard.markers.contains { $0.level == 0.5 && $0.ms >= 2_010 + Self.lead && $0.ms <= 2_020 + Self.lead })
        let after = try Self.render(until: 4_000, [
            (0, { $0.bedIn("beat-minor"); $0.cue("hour") }),
            (2_000, { $0.hush() }),
        ])
        #expect(after.markers.filter { $0.ms >= 2_000 + Constants.hushMs }.isEmpty)
        #expect(after.markers.filter { $0.ms >= 2_000 }.allSatisfy { abs($0.level) < 0.2 })
    }

    @Test func aJingleAfterAHushStartsWhenItIsCued() throws {
        let heard = try Self.render(until: 3_000, [
            (0, { $0.bedIn("beat-minor") }),
            (1_000, { $0.hush() }),
            (2_000, { $0.cue("hour") }),
        ])
        #expect(Self.level(heard.markers, at: 2_000 + Self.lead) == 0.5)
        #expect(heard.markers.filter { $0.ms > 1_100 && $0.ms != 2_000 + Self.lead }.isEmpty)
    }

    @Test func theWindowLettingGoPhasesTheBeatOut() throws {
        let heard = try Self.render(until: 1_000 + 3 * Self.turn, [
            (1_000, { $0.bedIn("beat-major") }),
            (1_000 + Self.turn, { $0.windowLetGo() }),
        ])
        #expect(heard.markers.filter { $0.ms >= 1_000 + Self.turn + Self.lead + Constants.bedOutMs }.isEmpty)
    }

    @Test func jinglesThatOverlapEachHaveAPlayer() throws {
        let heard = try Self.render(until: 1_500, [
            (400, { $0.cue("breaking") }),
            (600, { $0.cue("hour") }),
            (800, { $0.cue("breaking") }),
        ])
        #expect(Self.level(heard.markers, at: 400 + Self.lead) == 0.5)
        #expect(Self.level(heard.markers, at: 600 + Self.lead) == 0.5)
        #expect(Self.level(heard.markers, at: 800 + Self.lead) == 0.5)
    }

    @Test func aMissingFileIsReportedAndItsSoundSkipped() throws {
        var lines: [String] = []
        var files = Self.files()
        files["hour"] = Self.folder.appendingPathComponent("nothing.caf")
        let engine = AVAudioEngine()
        try engine.enableManualRenderingMode(.offline, format: AVAudioFormat(standardFormatWithSampleRate: Self.rate, channels: 2)!, maximumFrameCount: 480)
        let desk = SoundDesk(engine: engine, clock: RenderClock(origin: 0, rate: Self.rate), files: files, realTime: false, log: { lines.append($0) })
        try engine.start()
        desk.start()
        desk.cue("hour")
        #expect(lines == ["error missing sound nothing.caf"])
        engine.stop()
    }
}
