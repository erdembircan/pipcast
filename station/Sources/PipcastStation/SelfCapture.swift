import AppKit

/// Writes a PNG of one of this process's own windows, as the window server draws it, glass included. A process can
/// capture its own windows without the Screen Recording permission. The function is unavailable in the SDK, so it is
/// looked up at run time; false when it is missing or the capture fails.
func writeSelfCapture(of window: NSWindow, to path: String) -> Bool {
    typealias Create = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
    guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else { return false }
    let create = unsafeBitCast(symbol, to: Create.self)
    // kCGWindowListOptionIncludingWindow; kCGWindowImageBoundsIgnoreFraming | kCGWindowImageBestResolution
    guard let image = create(.null, 1 << 3, CGWindowID(window.windowNumber), (1 << 0) | (1 << 3))?.takeRetainedValue(),
          let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { return false }
    return (try? png.write(to: URL(fileURLWithPath: path), options: .atomic)) != nil
}
