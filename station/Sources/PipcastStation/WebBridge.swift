import AppKit
import StationSound
import WebKit

/// The messages the page posts to the station, as packages/contract/src/types.ts
/// defines them. Anything else is ignored.
enum PageMessage {
    case ready
    case cue(String)
    case bed(String)
    case bedOut
    case hush
    case reported(at: Double)
    case window(wanted: Bool)
    case rendered
    case log(level: String, text: String)

    init?(body: Any) {
        guard let object = body as? [String: Any], let type = object["type"] as? String else { return nil }
        switch type {
        case "ready":
            self = .ready
        case "cue":
            guard let jingle = object["jingle"] as? String, SoundDesk.jingles.contains(jingle) else { return nil }
            self = .cue(jingle)
        case "bed":
            guard let bed = object["bed"] as? String, SoundDesk.beds.contains(bed) else { return nil }
            self = .bed(bed)
        case "bed-out":
            self = .bedOut
        case "hush":
            self = .hush
        case "reported":
            guard let at = (object["at"] as? NSNumber)?.doubleValue, at.isFinite else { return nil }
            self = .reported(at: at)
        case "window":
            guard let wanted = object["wanted"] as? Bool else { return nil }
            self = .window(wanted: wanted)
        case "rendered":
            self = .rendered
        case "log":
            guard let text = object["text"] as? String else { return nil }
            self = .log(level: (object["level"] as? String) == "error" ? "error" : "info", text: text)
        default:
            return nil
        }
    }
}

/// Receives the page's `pipcast` messages. Held weakly by the web view's
/// configuration's handler, so the web view and its owner can be freed.
final class PageBridge: NSObject, WKScriptMessageHandler {
    var onMessage: ((PageMessage) -> Void)?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let parsed = PageMessage(body: message.body) else { return }
        onMessage?(parsed)
    }
}

/// A web view that never takes focus or shows a menu: a view above it takes
/// every event.
final class StationWebView: WKWebView {
    override var acceptsFirstResponder: Bool { false }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.removeAllItems()
    }
}

/// Builds the web view with its `pipcast` message handler.
func makeStationWebView(bridge: PageBridge) -> StationWebView {
    let configuration = WKWebViewConfiguration()
    configuration.userContentController.add(bridge, name: "pipcast")
    configuration.preferences.isTextInteractionEnabled = false
    let web = StationWebView(frame: .zero, configuration: configuration)
    web.autoresizingMask = [.width, .height]
    // Nothing flashes white before the page paints.
    web.underPageBackgroundColor = .black
    return web
}

/// Sends the page a message. The message goes in as an argument and is never
/// built into the script text.
func send(_ message: [String: Any], to web: WKWebView, onError: @escaping (String) -> Void) {
    web.callAsyncJavaScript("window.pipcast && window.pipcast.receive(message)",
                            arguments: ["message": message], in: nil, in: .page) { result in
        if case let .failure(error) = result {
            onError("send failed: \(error.localizedDescription)")
        }
    }
}

/// `<assets>/web/index.html`, optionally with a fragment, which a file load keeps.
func pageURL(assets: String, fragment: String? = nil) -> (url: URL, readAccess: URL) {
    let folder = URL(fileURLWithPath: assets).appendingPathComponent("web", isDirectory: true)
    let file = folder.appendingPathComponent("index.html")
    var url = file
    if let fragment, let withFragment = URL(string: file.absoluteString + "#" + fragment) {
        url = withFragment
    }
    return (url, folder)
}
