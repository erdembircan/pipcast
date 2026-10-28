#if PIPCAST_DEV
import Foundation
import StationCore

/// The development build's way in for a cue, which scripts/live.sh builds and puts in the app: JSON files dropped
/// into the store's `dev` folder by scripts/cue.mjs. The station hands each one's text to the page as
/// `{ type: 'dev', cue }`, oldest first, and deletes it; the page reads it. The station that ships has none of this:
/// it is compiled only with PIPCAST_DEV.
struct DevCues {
    let folder: String

    init(paths: StorePaths) {
        folder = "\(paths.root)/dev"
    }

    /// Makes the folder, mode 0700 like the store's, when it is missing.
    func prepare() throws {
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
    }

    /// The cues waiting, oldest first: the `*.json` files by name, which scripts/cue.mjs starts with the time it
    /// wrote them. Never a `*.tmp`, which is still being written.
    func waiting() -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder)) ?? []
        return names.filter { $0.hasSuffix(".json") }.sorted().map { "\(folder)/\($0)" }
    }
}
#endif
