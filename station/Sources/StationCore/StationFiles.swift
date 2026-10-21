import Foundation

/// Writes a file whole to `<path>.tmp` and renames it into place, so a reader
/// sees the old version or the new one, never half of one.
public func writeAtomically(_ data: Data, to path: String) throws {
    let temporary = "\(path).tmp"
    try data.write(to: URL(fileURLWithPath: temporary))
    if rename(temporary, path) != 0 {
        let reason = String(cString: strerror(errno))
        try? FileManager.default.removeItem(atPath: temporary)
        throw StationFileError.rename(path: path, reason: reason)
    }
}

public enum StationFileError: Error, CustomStringConvertible {
    case rename(path: String, reason: String)

    public var description: String {
        switch self {
        case let .rename(path, reason): return "cannot rename into \(path): \(reason)"
        }
    }
}

/// `station.json`: `{ v, pid, startedAt, heartbeatAt, version }`.
public struct StationStatus: Codable, Equatable {
    public var v = 1
    public var pid: Int
    public var startedAt: Double
    public var heartbeatAt: Double
    public var version: String

    public init(pid: Int, startedAt: Double, heartbeatAt: Double, version: String = Constants.version) {
        self.pid = pid
        self.startedAt = startedAt
        self.heartbeatAt = heartbeatAt
        self.version = version
    }

    public func write(to path: String) throws {
        try writeAtomically(try JSONEncoder().encode(self), to: path)
    }

    public static func read(from path: String) -> StationStatus? {
        guard let data = FileManager.default.contents(atPath: path),
              let status = try? JSONDecoder().decode(StationStatus.self, from: data),
              status.v == 1, status.pid > 0 else { return nil }
        return status
    }

    public static func delete(at path: String) {
        try? FileManager.default.removeItem(atPath: path)
    }
}

/// `control.json`: `{ v, closedAt }`, when the window's close button was pressed.
public struct StationControl: Codable, Equatable {
    public var v = 1
    public var closedAt: Double

    public init(closedAt: Double) {
        self.closedAt = closedAt
    }

    public func write(to path: String) throws {
        try writeAtomically(try JSONEncoder().encode(self), to: path)
    }

    public static func read(from path: String) -> StationControl? {
        guard let data = FileManager.default.contents(atPath: path),
              let control = try? JSONDecoder().decode(StationControl.self, from: data),
              control.v == 1 else { return nil }
        return control
    }

    public static func delete(at path: String) {
        try? FileManager.default.removeItem(atPath: path)
    }
}
