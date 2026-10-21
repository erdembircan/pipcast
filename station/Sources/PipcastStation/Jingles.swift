import AVFoundation
import Foundation

/// One `AVAudioPlayer` per jingle file in `<assets>/sounds/`.
final class Jingles {
    static let names = ["breaking", "breaking-out", "hour", "hour-out"]

    private var players: [String: AVAudioPlayer] = [:]

    /// A missing or unreadable file is reported once, through `onProblem`, and skipped.
    init(folder: String, onProblem: (String) -> Void) {
        for name in Self.names {
            let url = URL(fileURLWithPath: folder).appendingPathComponent("\(name).m4a")
            guard FileManager.default.fileExists(atPath: url.path) else {
                onProblem("missing jingle \(name).m4a")
                continue
            }
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()
                players[name] = player
            } catch {
                onProblem("cannot load jingle \(name).m4a: \(error.localizedDescription)")
            }
        }
    }

    /// Plays a jingle from its start; one that is already playing starts over.
    func play(_ name: String) {
        guard let player = players[name] else { return }
        player.currentTime = 0
        player.play()
    }
}
