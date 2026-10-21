import AppKit
import StationCore

/// Lets this process set the pointer while another app is frontmost, which the station always is not. The window
/// server ignores a pointer set by an app that is not frontmost unless its connection says otherwise. A private
/// interface, looked up at run time; false when this macOS lacks it.
func allowPointerInBackground() -> Bool {
    let any = UnsafeMutableRawPointer(bitPattern: -2) // RTLD_DEFAULT
    typealias DefaultConnection = @convention(c) () -> Int32
    typealias SetProperty = @convention(c) (Int32, Int32, CFString, CFTypeRef) -> Int32
    guard let connection = dlsym(any, "_CGSDefaultConnection") ?? dlsym(any, "CGSMainConnectionID"),
          let set = dlsym(any, "CGSSetConnectionProperty") else { return false }
    let cid = unsafeBitCast(connection, to: DefaultConnection.self)()
    return unsafeBitCast(set, to: SetProperty.self)(cid, cid, "SetsCursorInBackground" as CFString, kCFBooleanTrue) == 0
}

/// macOS's own window-resize pointer for a grip, with one arrow when the window can only shrink or only grow.
func resizePointer(for edge: ResizeEdge, room: Geometry.ResizeRoom) -> NSCursor {
    if #available(macOS 15.0, *) {
        let position: NSCursor.FrameResizePosition
        switch edge {
        case .top: position = .top
        case .left: position = .left
        case .bottom: position = .bottom
        case .right: position = .right
        case .topLeft: position = .topLeft
        case .topRight: position = .topRight
        case .bottomLeft: position = .bottomLeft
        case .bottomRight: position = .bottomRight
        }
        let directions: NSCursor.FrameResizeDirection.Set
        switch room {
        case .both: directions = .all
        case .shrinkOnly: directions = .inward
        case .growOnly: directions = .outward
        }
        return NSCursor.frameResize(position: position, directions: directions)
    }
    switch edge {
    case .top, .bottom: return NSCursor.resizeUpDown
    default: return NSCursor.resizeLeftRight
    }
}
