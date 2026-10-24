import CoreGraphics
import Foundation

/// The window server's Spaces, through its private interface: the Space you are on, every display's Spaces,
/// the Spaces a window is on, and taking a window off some of them. Looked up at run time; `init` fails on a
/// macOS that lacks any of them.
public final class WindowServerSpaces {
    private typealias Connection = @convention(c) () -> Int32
    private typealias ActiveSpace = @convention(c) (Int32) -> UInt64
    private typealias CopyDisplaySpaces = @convention(c) (Int32) -> Unmanaged<CFArray>?
    private typealias CopyWindowSpaces = @convention(c) (Int32, Int32, CFArray) -> Unmanaged<CFArray>?
    private typealias RemoveWindows = @convention(c) (Int32, CFArray, CFArray) -> Void

    /// Every Space a window can be on: the current one, the others and the user's.
    private static let allSpaces: Int32 = 0x7

    private let connection: Int32
    private let activeSpace: ActiveSpace
    private let copyDisplaySpaces: CopyDisplaySpaces
    private let copyWindowSpaces: CopyWindowSpaces
    private let removeWindows: RemoveWindows

    public init?() {
        let any = UnsafeMutableRawPointer(bitPattern: -2) // RTLD_DEFAULT
        guard let connection = dlsym(any, "_CGSDefaultConnection") ?? dlsym(any, "CGSMainConnectionID"),
              let active = dlsym(any, "CGSGetActiveSpace"),
              let displays = dlsym(any, "CGSCopyManagedDisplaySpaces"),
              let windowSpaces = dlsym(any, "CGSCopySpacesForWindows"),
              let remove = dlsym(any, "CGSRemoveWindowsFromSpaces") else { return nil }
        self.connection = unsafeBitCast(connection, to: Connection.self)()
        activeSpace = unsafeBitCast(active, to: ActiveSpace.self)
        copyDisplaySpaces = unsafeBitCast(displays, to: CopyDisplaySpaces.self)
        copyWindowSpaces = unsafeBitCast(windowSpaces, to: CopyWindowSpaces.self)
        removeWindows = unsafeBitCast(remove, to: RemoveWindows.self)
    }

    /// The Space you are on.
    public func active() -> UInt64 {
        activeSpace(connection)
    }

    /// Every display's Spaces, as the window server lists them (`Spaces.ownFullScreen` reads them).
    public func displays() -> [[String: Any]] {
        copyDisplaySpaces(connection)?.takeRetainedValue() as? [[String: Any]] ?? []
    }

    /// The Spaces a window is on.
    public func spaces(of window: CGWindowID) -> [UInt64] {
        let list = copyWindowSpaces(connection, Self.allSpaces, [NSNumber(value: window)] as CFArray)?
            .takeRetainedValue() as? [NSNumber] ?? []
        return list.map(\.uint64Value)
    }

    /// Takes a window off these Spaces. It stays off them however often it is shown and hidden.
    public func remove(_ window: CGWindowID, from spaces: [UInt64]) {
        guard !spaces.isEmpty else { return }
        removeWindows(connection, [NSNumber(value: window)] as CFArray, spaces.map { NSNumber(value: $0) } as CFArray)
    }
}
