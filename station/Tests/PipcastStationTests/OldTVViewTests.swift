import AppKit
import Testing
@testable import PipcastStation

/// Old TV on the layers it works on, without a window: what the filters, the animations and the burst do to them.
@MainActor
@Suite struct OldTVViewTests {
    private func make() -> (web: NSView, view: OldTVView) {
        let web = NSView(frame: NSRect(x: 0, y: 0, width: 320, height: 180))
        web.wantsLayer = true
        let view = OldTVView(web: web)
        view.frame = web.bounds
        view.layoutSubtreeIfNeeded()
        return (web, view)
    }

    private func names(_ layer: CALayer?) -> [String] {
        (layer?.filters as? [CIFilter])?.map { $0.name } ?? []
    }

    private func keys(_ layer: CALayer?) -> Set<String> {
        Set(layer?.animationKeys() ?? [])
    }

    @Test func offLeavesThePictureAlone() {
        let (web, view) = make()
        view.set(on: false, reduceMotion: false)
        #expect(web.layer?.filters == nil)
        #expect(keys(web.layer).isEmpty)
    }

    @Test func onPutsTheFiltersAndTheirAnimationsOnThePicture() {
        let (web, view) = make()
        view.set(on: true, reduceMotion: false)
        #expect(names(web.layer).count == 6)
        #expect(names(web.layer).prefix(3) == ["jitterA", "jitterB", "head"])
        #expect(keys(web.layer) == ["oldtv.a", "oldtv.b", "oldtv.bottom"])
        view.set(on: false, reduceMotion: false)
        #expect(web.layer?.filters == nil)
        #expect(keys(web.layer).isEmpty)
    }

    @Test func reduceMotionKeepsOnlyTheStillPicture() {
        let (web, view) = make()
        view.set(on: true, reduceMotion: true)
        #expect(names(web.layer).count == 3)
        #expect(keys(web.layer).isEmpty)
        // Reduce Motion turned off while Old TV is on brings the moving part
        view.set(on: true, reduceMotion: false)
        #expect(names(web.layer).count == 6)
        #expect(keys(web.layer) == ["oldtv.a", "oldtv.b", "oldtv.bottom"])
        // And on again takes it away
        view.set(on: true, reduceMotion: true)
        #expect(names(web.layer).count == 3)
        #expect(keys(web.layer).isEmpty)
    }

    @Test func aBurstAddsFourBandsAndGoesWhenOldTVDoes() {
        let (web, view) = make()
        view.set(on: true, reduceMotion: false)
        view.startBurst()
        #expect(view.isBursting)
        #expect(names(web.layer).count == 10)
        #expect(keys(web.layer).isSuperset(of: ["oldtv.burst0", "oldtv.burst1", "oldtv.burst2", "oldtv.burst3"]))
        view.set(on: false, reduceMotion: false)
        #expect(!view.isBursting)
        #expect(web.layer?.filters == nil)
        #expect(keys(web.layer).isEmpty)
    }

    @Test func aBurstGoesWhenReduceMotionComesOn() {
        let (web, view) = make()
        view.set(on: true, reduceMotion: false)
        view.startBurst()
        view.set(on: true, reduceMotion: true)
        #expect(!view.isBursting)
        #expect(names(web.layer).count == 3)
        #expect(keys(web.layer).isEmpty)
    }

    @Test func aBurstGoesWhenTheSizeChangesAndTheBaseFiltersComeBack() {
        let (web, view) = make()
        view.set(on: true, reduceMotion: false)
        view.startBurst()
        view.frame = NSRect(x: 0, y: 0, width: 400, height: 225)
        view.layoutSubtreeIfNeeded()
        #expect(!view.isBursting)
        #expect(names(web.layer).count == 6)
        #expect(!keys(web.layer).contains("oldtv.burst0"))
    }
}
