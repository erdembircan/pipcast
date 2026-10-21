import AppKit
import StationCore
import WebKit

/// `snapshot`: draws one picture of the page and exits, for checks and the
/// README. The page is loaded with the fragment `#still` and sent
/// `{ type: 'still', input }`; the picture is taken once it posts `rendered`.
final class SnapshotRunner: NSObject, NSApplicationDelegate {
    private let options: SnapshotOptions
    private let input: [String: Any]
    private let bridge = PageBridge()
    private var web: StationWebView!
    private var window: NSWindow!
    private var finished = false

    init(options: SnapshotOptions, input: [String: Any]) {
        self.options = options
        self.input = input
        super.init()
    }

    private var size: NSSize {
        NSSize(width: options.width, height: (options.width * 9 / 16).rounded())
    }

    // The window is made here, never earlier.
    func applicationDidFinishLaunching(_ notification: Notification) {
        let size = self.size
        web = makeStationWebView(bridge: bridge)
        web.frame = NSRect(origin: .zero, size: size)
        bridge.onMessage = { [weak self] message in self?.receive(message) }

        // Off screen, borderless and unable to take focus.
        let panel = StationPanel()
        panel.level = .normal
        panel.hasShadow = false
        panel.setFrame(NSRect(x: -30_000, y: -30_000, width: size.width, height: size.height), display: false)
        panel.contentView = web
        window = panel
        panel.orderFrontRegardless()

        let page = pageURL(assets: options.assets, fragment: "still")
        web.loadFileURL(page.url, allowingReadAccessTo: page.readAccess)

        Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
            guard let self, !self.finished else { return }
            fail("snapshot timed out")
        }
    }

    private func receive(_ message: PageMessage) {
        switch message {
        case .ready:
            send(["type": "still", "input": input], to: web) { problem in
                fail(problem)
            }
        case .rendered:
            takePicture()
        default:
            break
        }
    }

    private func takePicture() {
        guard !finished else { return }
        finished = true
        let configuration = WKSnapshotConfiguration()
        configuration.rect = NSRect(origin: .zero, size: size)
        web.takeSnapshot(with: configuration) { [self] image, error in
            guard let image else { fail("cannot take the snapshot: \(error?.localizedDescription ?? "no image")") }
            do {
                try writePNG(image, to: options.out)
            } catch {
                fail("cannot write \(options.out): \(error.localizedDescription)")
            }
            exit(0)
        }
    }

    /// Draws the image into a bitmap at 2x and writes it as PNG.
    private func writePNG(_ image: NSImage, to path: String) throws {
        let size = self.size
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int((size.width * 2).rounded()), pixelsHigh: Int((size.height * 2).rounded()),
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        ) else { throw CocoaError(.fileWriteUnknown) }
        rep.size = size
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        guard let context = NSGraphicsContext(bitmapImageRep: rep) else { throw CocoaError(.fileWriteUnknown) }
        NSGraphicsContext.current = context
        image.draw(in: NSRect(origin: .zero, size: size), from: .zero, operation: .copy, fraction: 1)
        context.flushGraphics()
        guard let png = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
        try png.write(to: URL(fileURLWithPath: path))
    }
}

func runSnapshot(_ options: SnapshotOptions) -> Never {
    let normalized = SnapshotOptions(assets: absolutePath(options.assets), input: absolutePath(options.input),
                                     out: absolutePath(options.out), width: options.width)
    guard let data = FileManager.default.contents(atPath: normalized.input) else {
        fail("cannot read \(normalized.input)")
    }
    guard let object = try? JSONSerialization.jsonObject(with: data), let input = object as? [String: Any] else {
        fail("\(normalized.input) is not a JSON object")
    }

    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let runner = SnapshotRunner(options: normalized, input: input)
    app.delegate = runner
    app.run()
    exit(0)
}
