import Foundation

/// What the station needs to know of a session record to decide who is on air.
public struct SessionSummary: Equatable {
    public let id: String
    public let tunedInAt: Double
    public let checkedInAt: Double

    public init(id: String, tunedInAt: Double, checkedInAt: Double) {
        self.id = id
        self.tunedInAt = tunedInAt
        self.checkedInAt = checkedInAt
    }

    /// Decodes leniently from a record's JSON object: a record that lacks these
    /// three fields or has a schema version other than 1 gives nil.
    public init?(json: [String: Any]) {
        guard let version = Self.number(json["v"]), version == 1 else { return nil }
        guard let id = json["id"] as? String, !id.isEmpty else { return nil }
        guard let tunedInAt = Self.number(json["tunedInAt"]),
              let checkedInAt = Self.number(json["checkedInAt"]) else { return nil }
        self.init(id: id, tunedInAt: tunedInAt, checkedInAt: checkedInAt)
    }

    /// A finite JSON number; a boolean is not one.
    static func number(_ value: Any?) -> Double? {
        guard let value = value as? NSNumber else { return nil }
        if CFGetTypeID(value) == CFBooleanGetTypeID() { return nil }
        let double = value.doubleValue
        return double.isFinite ? double : nil
    }
}

/// A record as the store holds it: the summary, and the JSON object itself, so
/// the app can forward it to the page unchanged.
public struct RecordFile {
    public let summary: SessionSummary
    public let json: [String: Any]

    public init(summary: SessionSummary, json: [String: Any]) {
        self.summary = summary
        self.json = json
    }

    /// Reads one record's bytes; nil when they are not a record.
    public static func parse(_ data: Data) -> RecordFile? {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let json = object as? [String: Any],
              let summary = SessionSummary(json: json) else { return nil }
        return RecordFile(summary: summary, json: json)
    }

    /// Every record in the sessions folder. Only `*.json` files are read, never
    /// `*.tmp`; a file that cannot be read or parsed is skipped.
    public static func readAll(in sessionsFolder: String) -> [RecordFile] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: sessionsFolder)) ?? []
        var records: [RecordFile] = []
        for name in names.sorted() where name.hasSuffix(".json") {
            let path = "\(sessionsFolder)/\(name)"
            guard let data = FileManager.default.contents(atPath: path),
                  let record = parse(data) else { continue }
            records.append(record)
        }
        return records
    }
}

/// A record is live while its check-in is no older than the stale time and not
/// further ahead of now than the clock-skew allowance.
public func isLive(_ summary: SessionSummary, now: Double) -> Bool {
    now - summary.checkedInAt <= Constants.staleMs
        && summary.checkedInAt <= now + Constants.clockSkewMs
}

private func precedes(_ a: SessionSummary, _ b: SessionSummary) -> Bool {
    if a.tunedInAt != b.tunedInAt { return a.tunedInAt < b.tunedInAt }
    // The contract compares ids as strings in UTF-16 code units.
    return a.id.utf16.lexicographicallyPrecedes(b.id.utf16)
}

/// The live records sorted by `tunedInAt`, then `id`: every one of them.
public func onAir(_ summaries: [SessionSummary], now: Double) -> [SessionSummary] {
    summaries
        .filter { isLive($0, now: now) }
        .sorted(by: precedes)
}

/// The same rule over whole records, in on-air order.
public func onAir(_ records: [RecordFile], now: Double) -> [RecordFile] {
    records
        .filter { isLive($0.summary, now: now) }
        .sorted { precedes($0.summary, $1.summary) }
}
