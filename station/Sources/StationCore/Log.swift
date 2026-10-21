import Foundation

/// `station.log`: one line per event, `ISO-8601 time + space + message`. When
/// the file passes 1 MB it is cut back to its last 256 KB.
public final class StationLog {
    public static let limit = 1_000_000
    public static let keep = 256 * 1024

    private let path: String
    private let queue = DispatchQueue(label: "pipcast.station.log")

    public init(path: String) {
        self.path = path
    }

    public func write(_ message: String, at date: Date = Date()) {
        queue.sync {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let line = "\(formatter.string(from: date)) \(message)\n"
            trimIfNeeded()
            append(Data(line.utf8))
        }
    }

    private func append(_ data: Data) {
        if !FileManager.default.fileExists(atPath: path) {
            FileManager.default.createFile(atPath: path, contents: nil, attributes: [.posixPermissions: 0o600])
        }
        guard let handle = FileHandle(forWritingAtPath: path) else { return }
        defer { try? handle.close() }
        _ = try? handle.seekToEnd()
        try? handle.write(contentsOf: data)
    }

    private func trimIfNeeded() {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: path),
              let size = attributes[.size] as? Int, size > StationLog.limit,
              let data = FileManager.default.contents(atPath: path) else { return }
        var tail = data.suffix(StationLog.keep)
        // Start on a whole line.
        if let newline = tail.firstIndex(of: 0x0A), newline < tail.endIndex {
            tail = tail[tail.index(after: newline)...]
        }
        try? Data(tail).write(to: URL(fileURLWithPath: path))
    }
}
