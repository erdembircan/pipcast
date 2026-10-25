import AVFoundation
import Foundation
import StationCore

/// The station's sound. Each event the page sends changes what plays at once:
/// a jingle starts, the beat mixes in, the beat phases out, or a hush fades
/// everything out. One engine: three players for the jingles, so an outro's
/// ring can overlap the next segment's start, and one for the beat, which loops
/// one turn of itself for as long as it plays. Use it from the main thread only.
public final class SoundDesk {
    public static let jingles = ["breaking", "breaking-out", "hour", "hour-out"]
    public static let beds = ["beat-minor", "beat-major"]

    /// Every file the desk plays, by name: the jingles as AAC, and each bed's
    /// loop as Apple Lossless, so the loop comes round to the frame.
    public static func files(in folder: URL) -> [String: URL] {
        var files: [String: URL] = [:]
        for name in jingles { files[name] = folder.appendingPathComponent("\(name).m4a") }
        for name in beds { files[name] = folder.appendingPathComponent("\(name).caf") }
        return files
    }

    /// What an event starts, it starts this long after it comes: the time the
    /// engine needs to have a sound in hand before it plays it. Everything an
    /// event starts, the beat's phase-out too, starts at that one moment.
    static let leadMs = 40.0
    /// How long the engine runs on with nothing to play before it pauses.
    static let restMs = 1_000.0

    public let engine: AVAudioEngine
    private let clock: SoundClock
    private let realTime: Bool
    private let log: (String) -> Void
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    /// What each bed mixes in on, made once: the last notes of its turn,
    /// rising evenly from silence, so the downbeat after them lands at full.
    private var mixingIn: [String: AVAudioPCMBuffer] = [:]
    private let format: AVAudioFormat
    private let stings = (0..<3).map { _ in AVAudioPlayerNode() }
    /// What each jingle player last started, when, and until when it plays.
    private var stingPlaying: [(name: String, from: Double, until: Double)?] = [nil, nil, nil]
    private let bedPlayer = AVAudioPlayerNode()

    private struct Bed {
        var name: String
        /// When its first downbeat lands, as it reaches full.
        var from: Double
        /// When it started to phase out, once it has.
        var goingFrom: Double?
    }
    private var bed: Bed?
    private var hushFrom: Double?
    private var idleSince: Double?
    private var pumpTimer: Timer?
    private var observer: NSObjectProtocol?

    /// The station's desk: the files in `folder`, in real time.
    public convenience init(folder: URL, log: @escaping (String) -> Void) {
        self.init(engine: AVAudioEngine(), clock: HostClock(), files: Self.files(in: folder), realTime: true, log: log)
    }

    /// `files`: each sound's file, by name. One that is missing or cannot be
    /// read is reported through `log` once and skipped. In real time the desk
    /// starts the engine when it has something to play, runs its own pump,
    /// pauses the engine when nothing is left, and starts it again after the
    /// output changes. Offline, the caller puts the engine in manual rendering
    /// mode, starts it, calls `start()`, and calls `pump()` between renders.
    public init(engine: AVAudioEngine, clock: SoundClock, files: [String: URL], realTime: Bool, log: @escaping (String) -> Void) {
        self.engine = engine
        self.clock = clock
        self.realTime = realTime
        self.log = log
        var loaded: [String: AVAudioPCMBuffer] = [:]
        for (name, url) in files.sorted(by: { $0.key < $1.key }) {
            guard FileManager.default.fileExists(atPath: url.path) else {
                log("error missing sound \(url.lastPathComponent)")
                continue
            }
            do {
                let file = try AVAudioFile(forReading: url)
                guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else {
                    log("error cannot load sound \(url.lastPathComponent)")
                    continue
                }
                try file.read(into: buffer)
                loaded[name] = buffer
            } catch {
                log("error cannot load sound \(url.lastPathComponent): \(error.localizedDescription)")
            }
        }
        format = loaded["breaking"]?.format ?? loaded.values.first?.format
            ?? AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!
        for (name, buffer) in loaded where buffer.format != format {
            log("error sound \(name) is not in the jingles' format")
            loaded[name] = nil
        }
        buffers = loaded
        for name in Self.beds {
            if let loop = loaded[name] { mixingIn[name] = loop.mixingIn(over: Constants.bedInMs) }
        }
        for player in stings + [bedPlayer] {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
        }
        if realTime {
            observer = NotificationCenter.default.addObserver(
                forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
            ) { [weak self] _ in self?.outputChanged() }
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
        pumpTimer?.invalidate()
    }

    /// Offline: starts the players once the caller has started the engine.
    public func start() {
        for player in stings + [bedPlayer] { play(player) }
    }

    // MARK: What the page asks for

    /// A jingle starts.
    public func cue(_ name: String) {
        guard let buffer = buffers[name] else { return }
        finishHush()
        guard wake() else { return }
        let start = clock.now() + Self.leadMs
        let index = freeSting(at: start)
        let player = stings[index]
        player.scheduleBuffer(buffer, at: clock.time(start, for: player), options: [], completionHandler: nil)
        stingPlaying[index] = (name, start, start + length(of: buffer))
    }

    /// The beat mixes in on the last notes of its line, and loops from its
    /// downbeat until it is told to go.
    public func bedIn(_ name: String) {
        guard let loop = buffers[name], let first = mixingIn[name] else { return }
        finishHush()
        guard wake() else { return }
        if bed != nil { stopBed() }
        let start = clock.now() + Self.leadMs
        bedPlayer.volume = 1
        bedPlayer.scheduleBuffer(first, at: clock.time(start, for: bedPlayer), options: [], completionHandler: nil)
        bedPlayer.scheduleBuffer(loop, at: nil, options: .loops, completionHandler: nil)
        bed = Bed(name: name, from: start + length(of: first))
    }

    /// The beat phases out, from the moment what came with the same event starts.
    public func bedOut() {
        guard var current = bed, current.goingFrom == nil else { return }
        current.goingFrom = clock.now() + Self.leadMs
        bed = current
        pump()
    }

    /// A segment needs the window: one is on its way. The engine starts now, so
    /// that the segment's first sound plays on time even on an output that
    /// takes a moment to start, such as Bluetooth headphones, while the window
    /// comes out of the side. If nothing comes, it rests again.
    public func warm() {
        guard hushFrom == nil else { return }
        wake()
    }

    /// No segment needs the window any longer: a beat the page left playing
    /// phases out.
    public func windowLetGo() {
        bedOut()
    }

    /// A cut: everything playing fades out.
    public func hush() {
        guard hushFrom == nil else { return }
        guard busy(at: clock.now()) else {
            clear()
            return
        }
        hushFrom = clock.now()
        pump()
    }

    // MARK: On the clock

    /// Time-driven work: a hush's fade, the beat's phase-out, and in real time,
    /// pausing the engine once nothing is left to play.
    public func pump() {
        let now = clock.now()
        if let from = hushFrom {
            let done = (now - from) / Constants.hushMs
            if done >= 1 {
                finishHush()
            } else {
                engine.mainMixerNode.outputVolume = hushGain(done)
            }
        }
        if let from = bed?.goingFrom {
            let done = (now - from) / Constants.bedOutMs
            if done >= 1 {
                stopBed()
            } else {
                bedPlayer.volume = phaseOutGain(done)
            }
        }
        if realTime { restIfIdle(now) }
    }

    // MARK: The engine

    /// Starts the engine if it has stopped, with the players and the pump. In
    /// real time only; false when the engine cannot start.
    @discardableResult
    private func wake() -> Bool {
        idleSince = nil
        guard realTime else { return true }
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                // After the output changes, its format may have too: the main
                // mixer meets it afresh
                engine.connect(engine.mainMixerNode, to: engine.outputNode, format: nil)
                do {
                    try engine.start()
                } catch {
                    log("error cannot start the sound: \(error.localizedDescription)")
                    return false
                }
            }
            for player in stings + [bedPlayer] { play(player) }
        }
        if pumpTimer == nil {
            let timer = Timer(timeInterval: 0.01, repeats: true) { [weak self] _ in self?.pump() }
            RunLoop.main.add(timer, forMode: .common)
            pumpTimer = timer
        }
        return true
    }

    private func restIfIdle(_ now: Double) {
        guard !busy(at: now) else {
            idleSince = nil
            return
        }
        guard let since = idleSince else {
            idleSince = now
            return
        }
        if now - since >= Self.restMs {
            engine.pause()
            pumpTimer?.invalidate()
            pumpTimer = nil
            idleSince = nil
        }
    }

    /// The output changed, a device plugged in or out, and the engine stopped
    /// by itself. What was still playing plays on from where it had got to.
    private func outputChanged() {
        let now = clock.now()
        let jingles = stingPlaying.compactMap { $0 }.filter { $0.until > now }
        let beat = bed?.goingFrom == nil ? bed : nil
        clear()
        pumpTimer?.invalidate()
        pumpTimer = nil
        guard !jingles.isEmpty || beat != nil else { return }
        guard wake() else { return }
        let start = clock.now() + Self.leadMs
        for jingle in jingles {
            guard let buffer = buffers[jingle.name], let piece = buffer.frames(from: frames(start - jingle.from, in: buffer)) else { continue }
            let index = freeSting(at: start)
            stings[index].scheduleBuffer(piece, at: clock.time(start, for: stings[index]), options: [], completionHandler: nil)
            stingPlaying[index] = jingle
        }
        if let beat, let loop = buffers[beat.name] {
            // Where in its turn the beat has got to; before its first downbeat,
            // in the notes it mixes in on
            var into = (start - beat.from).truncatingRemainder(dividingBy: length(of: loop))
            if into < 0 { into += length(of: loop) }
            if let piece = loop.frames(from: frames(into, in: loop)) {
                bedPlayer.scheduleBuffer(piece, at: clock.time(start, for: bedPlayer), options: [], completionHandler: nil)
                bedPlayer.scheduleBuffer(loop, at: nil, options: .loops, completionHandler: nil)
            } else {
                bedPlayer.scheduleBuffer(loop, at: clock.time(start, for: bedPlayer), options: .loops, completionHandler: nil)
            }
            bed = beat
        }
        log("sound playing again after the output changed")
    }

    // MARK: Pieces

    /// Anything playing at `now`.
    private func busy(at now: Double) -> Bool {
        hushFrom != nil || bed != nil || stingPlaying.contains { ($0?.until ?? 0) > now }
    }

    /// The jingle player that is free at `now`; with none free, the one that
    /// frees soonest, cut short.
    private func freeSting(at now: Double) -> Int {
        var soonest = 0
        for index in stings.indices {
            guard let playing = stingPlaying[index] else { return index }
            if playing.until <= now { return index }
            if playing.until < (stingPlaying[soonest]?.until ?? 0) { soonest = index }
        }
        stings[soonest].stop()
        play(stings[soonest])
        return soonest
    }

    private func stopBed() {
        bedPlayer.stop()
        if !realTime || engine.isRunning { play(bedPlayer) }
        bedPlayer.volume = 1
        bed = nil
    }

    /// Stops every player and forgets what was playing.
    private func clear() {
        for player in stings + [bedPlayer] {
            player.stop()
            if !realTime || engine.isRunning { play(player) }
        }
        stingPlaying = [nil, nil, nil]
        bed = nil
        hushFrom = nil
        bedPlayer.volume = 1
        engine.mainMixerNode.outputVolume = 1
    }

    private func finishHush() {
        if hushFrom != nil { clear() }
    }

    /// Starts a player, and tells the clock its timeline starts over.
    private func play(_ player: AVAudioPlayerNode) {
        player.play()
        clock.started(player)
    }

    private func length(of buffer: AVAudioPCMBuffer) -> Double {
        Double(buffer.frameLength) / buffer.format.sampleRate * 1000
    }

    private func frames(_ ms: Double, in buffer: AVAudioPCMBuffer) -> AVAudioFramePosition {
        AVAudioFramePosition((ms / 1000 * buffer.format.sampleRate).rounded())
    }
}

extension AVAudioPCMBuffer {
    /// A copy of the frames from `from` to the end; nil when there are none.
    func frames(from: AVAudioFramePosition) -> AVAudioPCMBuffer? {
        let start = AVAudioFrameCount(max(0, from))
        guard start < frameLength,
              let piece = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameLength - start),
              let source = floatChannelData, let target = piece.floatChannelData else { return nil }
        piece.frameLength = frameLength - start
        for channel in 0..<Int(format.channelCount) {
            target[channel].update(from: source[channel] + Int(start), count: Int(piece.frameLength))
        }
        return piece
    }

    /// A copy of the last `ms` of a turn, rising evenly from silence: what a
    /// bed mixes in on, so that the turn's downbeat, which comes round after
    /// it, lands at full.
    func mixingIn(over ms: Double) -> AVAudioPCMBuffer {
        let ramp = AVAudioFrameCount(min(Double(frameLength), max(1, (ms / 1000 * format.sampleRate).rounded())))
        guard let copy = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: ramp),
              let source = floatChannelData, let target = copy.floatChannelData else { return self }
        copy.frameLength = ramp
        let from = Int(frameLength - ramp)
        for channel in 0..<Int(format.channelCount) {
            for i in 0..<Int(ramp) {
                target[channel][i] = source[channel][from + i] * mixInGain(Double(i) / Double(ramp))
            }
        }
        return copy
    }
}
