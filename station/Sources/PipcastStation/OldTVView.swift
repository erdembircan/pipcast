import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import QuartzCore
import StationCore

/// Old TV: the window's picture as a 1990s broadcast taped and played back on an old television. The station draws
/// all of it on layers, and the page does no work for it. The picture is the web view's layer with macOS's own Core
/// Image filters on it, which the window server runs over WebKit's picture: the lines wobble and the bottom tears
/// with `CIDisplacementDistortion`, one value to a row of points, and Core Animation steps each filter's strength
/// frame by frame by itself. Above it, this view's plain layers hold the grain, the colour noise, the dropouts and
/// the tube: its lines, dark corners, rim and sheen. The window server ignores a filter of our own, so only Apple's
/// built-in ones are used.
///
/// The view takes no event. While Reduce Motion is on, only what holds still shows: the soft picture and the tube.
final class OldTVView: NSView {
    private weak var web: NSView?
    private(set) var isOn = false
    private var reducesMotion = false
    private var random = OldTVRandom(seed: mach_absolute_time())

    // The layers, back to front
    private let grain = CALayer()
    private let chroma = CALayer()
    private let dropout = CALayer()
    private let lines = CAReplicatorLayer()
    private let line = CALayer()
    private let corners = CAGradientLayer()
    private let rim = CALayer()
    private let sheen = CAGradientLayer()

    /// The size the layers were last fitted to.
    private var laidOut = CGSize.zero
    /// The filters on the web view's layer when no burst is on it.
    private var baseFilters: [CIFilter] = []
    /// Drops the grain and the colour noise that were still being made when the size changed again or Old TV went off.
    private var generation = 0
    private var noiseWork: DispatchWorkItem?

    private struct Burst {
        let token: Int
        let keys: [String]
        let streak: CALayer
        let restore: DispatchWorkItem
    }

    private var burst: Burst?
    /// Whether a burst is on the picture.
    var isBursting: Bool { burst != nil }
    /// Raised whenever a burst ends or is cancelled, so a restore that comes late finds it is no longer its own.
    private var burstToken = 0
    private var burstTimer: Timer?

    private static let signalKeys = ["oldtv.a", "oldtv.b", "oldtv.bottom"]

    init(web: NSView) {
        self.web = web
        super.init(frame: .zero)
        wantsLayer = true
        autoresizingMask = [.width, .height]
        guard let root = layer else { return }

        grain.magnificationFilter = .nearest
        chroma.magnificationFilter = .linear
        chroma.compositingFilter = "softLightBlendMode"
        dropout.backgroundColor = NSColor.white.cgColor
        line.backgroundColor = NSColor.black.withAlphaComponent(OldTVLook.linesOpacity).cgColor
        lines.addSublayer(line)

        corners.type = .radial
        corners.colors = OldTVLook.cornersAlpha.map { NSColor.black.withAlphaComponent($0).cgColor }
        corners.locations = OldTVLook.cornersLocations.map { NSNumber(value: Double($0)) }
        corners.startPoint = CGPoint(x: 0.5, y: 0.5)
        corners.endPoint = OldTVLook.cornersEnd

        rim.borderWidth = OldTVLook.rimWidth
        rim.borderColor = NSColor.black.cgColor
        rim.shadowColor = NSColor.black.cgColor
        rim.shadowOpacity = OldTVLook.rimShadowOpacity
        rim.shadowOffset = .zero

        sheen.colors = [NSColor.white.withAlphaComponent(OldTVLook.sheenAlpha).cgColor,
                        NSColor.white.withAlphaComponent(0).cgColor]
        sheen.startPoint = OldTVLook.sheenStart
        sheen.endPoint = OldTVLook.sheenEnd

        for layer in [grain, chroma, dropout, lines, corners, rim, sheen] {
            Self.quiet(layer)
            layer.isHidden = true
            root.addSublayer(layer)
        }
        Self.quiet(line)
        Self.quiet(root)
    }

    required init?(coder: NSCoder) { fatalError("not loaded from a nib") }

    // Nothing here takes an event: the interaction view above it does.
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    // MARK: State

    /// Turns Old TV on or off, and says whether Reduce Motion is on: then only the still part shows. Nothing happens
    /// when neither changed.
    func set(on: Bool, reduceMotion: Bool) {
        if !on && !isOn {
            reducesMotion = reduceMotion
            return
        }
        guard on != isOn || reduceMotion != reducesMotion else { return }
        cancelBurst()
        isOn = on
        reducesMotion = reduceMotion
        if on { install() } else { remove() }
    }

    private func install() {
        withoutActions {
            fitLayers()
            for layer in [lines, corners, rim, sheen] { layer.isHidden = false }
        }
        installSignal()
        installNoise()
        scheduleBurst()
    }

    private func remove() {
        burstTimer?.invalidate()
        burstTimer = nil
        noiseWork?.cancel()
        noiseWork = nil
        generation &+= 1
        baseFilters = []
        withoutActions {
            if let layer = web?.layer {
                layer.filters = nil
                for key in Self.signalKeys { layer.removeAnimation(forKey: key) }
            }
            for layer in [grain, chroma, dropout, lines, corners, rim, sheen] { layer.isHidden = true }
            releaseNoise()
        }
    }

    /// Frees the grain, the colour noise and the dropout.
    private func releaseNoise() {
        for layer in [grain, chroma, dropout] {
            layer.removeAllAnimations()
            layer.contents = nil
        }
    }

    // MARK: Layout

    override func layout() {
        super.layout()
        guard bounds.size != laidOut else { return }
        laidOut = bounds.size
        // Every layer follows the size at once, the noise stretched meanwhile
        withoutActions { fitLayers() }
        guard isOn else { return }
        // The maps and the dropout are tiny, so they follow at once: no row of a larger picture is ever outside a map
        cancelBurst()
        installSignal()
        if !reducesMotion {
            installDropout()
            // The noise is made again only once the size has stopped changing
            noiseWork?.cancel()
            generation &+= 1
            let work = DispatchWorkItem { [weak self] in self?.makeNoise() }
            noiseWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: work)
        }
    }

    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        withoutActions { fitLines() }
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        withoutActions { fitLines() }
    }

    /// Picture width over the width the look is tuned at.
    private var k: CGFloat { max(bounds.width, 1) / OldTVLook.referenceWidth }

    private func fitLayers() {
        let frame = bounds
        for layer in [grain, chroma, corners, sheen] { layer.frame = frame }
        rim.frame = frame.insetBy(dx: -OldTVLook.rimWidth, dy: -OldTVLook.rimWidth)
        rim.cornerRadius = OldTVLook.rimWidth + 26 * k
        rim.shadowRadius = 9 * k
        lines.frame = frame
        fitLines()
    }

    /// The tube's lines, a whole number of the screen's pixels apart.
    private func fitLines() {
        let scale = window?.backingScaleFactor ?? 2
        let pitch = OldTVLook.linePitch(height: bounds.height, scale: scale)
        line.frame = CGRect(x: 0, y: 0, width: bounds.width, height: pitch / 2)
        lines.instanceCount = Int(bounds.height / pitch) + 1
        lines.instanceTransform = CATransform3DMakeTranslation(0, pitch, 0)
    }

    // MARK: The signal

    private func displacement(_ name: String, _ rows: [Double]) -> CIFilter? {
        guard let map = OldTVImages.rowMap(rows: rows), let filter = CIFilter(name: "CIDisplacementDistortion") else { return nil }
        filter.name = name
        // The map is in layer points: a point wide column of rows, stretched to the picture's width
        filter.setValue(CIImage(cgImage: map).transformed(by: CGAffineTransform(scaleX: bounds.width / 4, y: 1)),
                        forKey: "inputDisplacementImage")
        filter.setValue(0, forKey: kCIInputScaleKey)
        return filter
    }

    private static func keyframes(_ path: String, _ values: [Any], fps: Double) -> CAKeyframeAnimation {
        let animation = CAKeyframeAnimation(keyPath: path)
        animation.values = values
        animation.calculationMode = .discrete
        animation.duration = Double(values.count) / fps
        animation.repeatCount = .infinity
        return animation
    }

    /// The filters on the web view's layer: the lines wobble and the bottom tears, then the picture goes soft and
    /// glows, with a touch more colour. With Reduce Motion on, only the second part.
    private func installSignal() {
        guard let layer = web?.layer else { return }
        let rows = max(1, Int(ceil(bounds.height)))
        var filters: [CIFilter] = []
        var animations: [(String, CAKeyframeAnimation)] = []
        if !reducesMotion,
           let a = displacement("jitterA", OldTVLook.wobbleRows(count: rows, random: &random)),
           let b = displacement("jitterB", OldTVLook.wobbleRows(count: rows, random: &random)),
           let bottom = displacement("head", OldTVLook.bottomRows(count: rows, random: &random)) {
            filters = [a, b, bottom]
            let wobble = OldTVLook.wobbleAmplitude * Double(k)
            let tear = OldTVLook.bottomAmplitude * Double(k)
            let fps = OldTVLook.fps
            animations = [
                ("oldtv.a", Self.keyframes("filters.jitterA.inputScale",
                                           OldTVLook.wobbleScales(frames: OldTVLook.wobbleFramesA, amplitude: wobble, random: &random), fps: fps)),
                ("oldtv.b", Self.keyframes("filters.jitterB.inputScale",
                                           OldTVLook.wobbleScales(frames: OldTVLook.wobbleFramesB, amplitude: wobble, random: &random), fps: fps)),
                ("oldtv.bottom", Self.keyframes("filters.head.inputScale",
                                                OldTVLook.bottomScales(frames: OldTVLook.bottomFrames, amplitude: tear, random: &random), fps: fps)),
            ]
        }
        let blur = CIFilter.motionBlur()
        blur.radius = Float(OldTVLook.blurRadius * Double(max(k, 0.75)))
        blur.angle = 0
        let bloom = CIFilter.bloom()
        bloom.radius = Float(OldTVLook.bloomRadius * Double(k))
        bloom.intensity = Float(OldTVLook.bloomIntensity)
        let colour = CIFilter.colorControls()
        colour.saturation = Float(OldTVLook.saturation)
        colour.contrast = Float(OldTVLook.contrast)
        colour.brightness = Float(OldTVLook.brightness)
        colour.name = "color"
        filters += [blur, bloom, colour]
        baseFilters = filters
        withoutActions {
            for key in Self.signalKeys { layer.removeAnimation(forKey: key) }
            layer.filters = filters
            for (key, animation) in animations { layer.add(animation, forKey: key) }
        }
    }

    // MARK: The noise

    /// Grain, colour noise and dropouts, each on a loop of its own length, or nothing of them with Reduce Motion on.
    private func installNoise() {
        withoutActions {
            if reducesMotion {
                for layer in [grain, chroma, dropout] { layer.isHidden = true }
                releaseNoise()
            } else {
                for layer in [grain, chroma, dropout] { layer.isHidden = false }
                grain.opacity = OldTVLook.grainOpacity
                chroma.opacity = OldTVLook.chromaOpacity
                installDropout()
            }
        }
        if !reducesMotion {
            generation &+= 1
            makeNoise()
        }
    }

    /// Makes the grain and the colour noise away from the main thread, and puts them on their layers unless the size
    /// or the state changed meanwhile.
    private func makeNoise() {
        noiseWork = nil
        guard isOn, !reducesMotion, bounds.width >= 1, bounds.height >= 1 else { return }
        let token = generation
        let width = Int(bounds.width.rounded()), height = Int(bounds.height.rounded())
        let seed = random.nextSeed()
        DispatchQueue.global(qos: .utility).async { [weak self] in
            var random = OldTVRandom(seed: seed)
            let grains = (0 ..< OldTVLook.grainFrames).compactMap { _ in
                OldTVImages.grain(width: width, height: height, random: &random)
            }
            let colours = (0 ..< OldTVLook.chromaFrames).compactMap { _ in
                OldTVImages.colourNoise(width: max(1, width / OldTVLook.chromaDivisor),
                                        height: max(1, height / OldTVLook.chromaDivisor), random: &random)
            }
            DispatchQueue.main.async {
                guard let self, token == self.generation, self.isOn, !self.reducesMotion else { return }
                self.show(grains: grains, colours: colours)
            }
        }
    }

    private func show(grains: [CGImage], colours: [CGImage]) {
        withoutActions {
            if let first = grains.first {
                grain.contents = first
                grain.add(Self.keyframes("contents", grains, fps: OldTVLook.fps), forKey: "oldtv.grain")
            }
            if let first = colours.first {
                chroma.contents = first
                chroma.add(Self.keyframes("contents", colours, fps: OldTVLook.chromaFPS), forKey: "oldtv.chroma")
            }
        }
    }

    /// The dropout: one white layer a point tall that, in about one frame in five, is a streak of 8 to 58 points
    /// somewhere in the picture, and otherwise invisible. Position, size and opacity step together.
    private func installDropout() {
        dropout.removeAllAnimations()
        let width = bounds.width, height = bounds.height
        var positions: [NSValue] = []
        var sizes: [NSValue] = []
        var opacities: [NSNumber] = []
        var lastPosition = NSPoint.zero
        var lastBounds = CGRect(x: 0, y: 0, width: 1, height: 1)
        for _ in 0 ..< OldTVLook.dropoutFrames {
            if random.next() < OldTVLook.dropoutChance {
                let y = (random.next() * max(1, height - 2)).rounded(.down)
                let x = (random.next() * max(1, width - 60)).rounded(.down)
                let length = (OldTVLook.dropoutLength.lowerBound
                    + random.next() * (OldTVLook.dropoutLength.upperBound - OldTVLook.dropoutLength.lowerBound)).rounded(.down)
                lastPosition = NSPoint(x: x + length / 2, y: y + 0.5)
                lastBounds = CGRect(x: 0, y: 0, width: length, height: 1)
                opacities.append(NSNumber(value: OldTVLook.dropoutOpacity))
            } else {
                opacities.append(NSNumber(value: Float(0)))
            }
            positions.append(NSValue(point: lastPosition))
            sizes.append(NSValue(rect: lastBounds))
        }
        dropout.position = lastPosition
        dropout.bounds = lastBounds
        dropout.opacity = 0
        let begin = dropout.convertTime(CACurrentMediaTime(), from: nil)
        for (path, values) in [("position", positions), ("bounds", sizes), ("opacity", opacities)] as [(String, [Any])] {
            let animation = Self.keyframes(path, values, fps: OldTVLook.fps)
            animation.beginTime = begin
            dropout.add(animation, forKey: "oldtv.dropout.\(path)")
        }
    }

    // MARK: The tracking burst

    /// One burst at a time, every 20 to 90 seconds at random.
    private func scheduleBurst() {
        burstTimer?.invalidate()
        burstTimer = nil
        guard isOn, !reducesMotion else { return }
        let delay = OldTVLook.nextBurstDelay(random: &random)
        let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in self?.burstTimerFired() }
        RunLoop.main.add(timer, forMode: .common)
        burstTimer = timer
    }

    private func burstTimerFired() {
        // A burst waits while the window is hidden; the next one is drawn all the same
        if isOn, !reducesMotion, burst == nil, window?.occlusionState.contains(.visible) == true {
            startBurst()
        }
        scheduleBurst()
    }

    /// A band of torn rows that runs down part of the picture for half a second, with bright streaks riding with it.
    func startBurst() {
        guard let layer = web?.layer, let root = self.layer, baseFilters.count >= 3,
              bounds.width >= 1, bounds.height >= 1 else { return }
        let rows = max(1, Int(ceil(bounds.height)))
        let width = bounds.width, height = bounds.height
        let range = OldTVLook.burstStartRange
        let start = range.lowerBound + random.next() * (range.upperBound - range.lowerBound)
        let band = OldTVLook.burstBand, travel = OldTVLook.burstTravel, steps = OldTVLook.burstSteps
        var filters = baseFilters
        var keys: [String] = []
        var animations: [(String, CAKeyframeAnimation)] = []
        for i in 0 ..< 4 {
            let top = Int((start + travel * Double(i) / 3) * Double(rows))
            let bottom = top + Int(band * Double(rows))
            guard let filter = displacement("burst\(i)", OldTVLook.burstRows(count: rows, top: top, bottom: bottom, random: &random)) else { continue }
            filters.insert(filter, at: 3)
            let scales = OldTVLook.burstScales(index: i, steps: steps, amplitude: OldTVLook.burstAmplitude * Double(k), random: &random)
            let animation = Self.keyframes("filters.burst\(i).inputScale", scales, fps: OldTVLook.fps)
            animation.repeatCount = 1
            animation.fillMode = .forwards
            animation.isRemovedOnCompletion = false
            animations.append(("oldtv.burst\(i)", animation))
            keys.append("oldtv.burst\(i)")
        }
        // The band's own noise: bright streaks riding with it
        let streak = CALayer()
        Self.quiet(streak)
        let bandHeight = height * band
        streak.frame = CGRect(x: 0, y: 0, width: width, height: bandHeight)
        let frames = (0 ..< 6).compactMap { _ in
            OldTVImages.streaks(width: Int(width), height: max(1, Int(bandHeight)), random: &random)
        }
        if let first = frames.first {
            streak.contents = first
            streak.add(Self.keyframes("contents", frames, fps: OldTVLook.fps), forKey: "oldtv.streaks")
        }
        let move = CABasicAnimation(keyPath: "position.y")
        let from = height * CGFloat(1 - start) - bandHeight / 2
        let to = height * CGFloat(1 - start - travel) - bandHeight / 2
        move.fromValue = from
        move.toValue = to
        move.duration = Double(steps) / OldTVLook.fps
        streak.position.y = to
        streak.add(move, forKey: "oldtv.move")

        burstToken &+= 1
        let token = burstToken
        let restore = DispatchWorkItem { [weak self] in
            guard let self, self.burst?.token == token else { return }
            self.cancelBurst()
        }
        burst = Burst(token: token, keys: keys, streak: streak, restore: restore)
        withoutActions {
            layer.filters = filters
            for (key, animation) in animations { layer.add(animation, forKey: key) }
            root.insertSublayer(streak, at: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(steps) / OldTVLook.fps + 0.05, execute: restore)
    }

    /// Ends the burst that is on, or does nothing: its filters, its animations and its streaks go at once and the
    /// base filters come back, or none when Old TV is off. Whatever changes the state calls it first, and a restore
    /// that comes late finds its token gone.
    private func cancelBurst() {
        guard let burst else { return }
        self.burst = nil
        burstToken &+= 1
        burst.restore.cancel()
        withoutActions {
            if let layer = web?.layer {
                for key in burst.keys { layer.removeAnimation(forKey: key) }
                layer.filters = isOn ? baseFilters : nil
            }
            burst.streak.removeFromSuperlayer()
        }
    }

    // MARK: Layers

    private func withoutActions(_ body: () -> Void) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        body()
        CATransaction.commit()
    }

    /// A layer that never animates by itself: only the animations added to it run.
    private static func quiet(_ layer: CALayer) {
        let none = NSNull()
        layer.actions = ["position": none, "bounds": none, "contents": none, "opacity": none, "hidden": none,
                         "frame": none, "anchorPoint": none, "transform": none, "backgroundColor": none,
                         "colors": none, "sublayers": none, "instanceCount": none, "instanceTransform": none,
                         "cornerRadius": none, "shadowRadius": none, "onOrderIn": none, "onOrderOut": none]
    }
}
