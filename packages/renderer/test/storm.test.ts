// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { describe, expect, it } from 'vitest'

import '../src/design.ts'

type Vec = [number, number, number]

interface Pose {
  eye: Vec
  look: Vec
  up: Vec
}

interface View {
  eye: Vec
  world: number[]
  inverse: number[]
  projection: number[]
}

interface StormPose {
  s: number
  scale: number
  position: Vec
  turn: [number, number, number, number]
  spin: number
  formed: number
  shadow: Vec
  flash: number
  landfall: number
}

const storm = (window as unknown as {
  PipNews: {
    stormScene: {
      cameraPose(t: number): Pose
      viewOf(pose: Pose, aspect: number): View
      screenPoint(v: Vec, view: View, width: number, height: number): { x: number; y: number; on: boolean }
      stormPose(t: number): StormPose
      trackAt(s: number, radius: number): Vec
    }
  }
}).PipNews.stormScene

const length = (v: Vec): number => Math.hypot(v[0], v[1], v[2])
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const W = 840
const H = 306
const seconds = Array.from({ length: 131 }, (_, i) => i / 10)

describe('STORMTRACKER’s camera', () => {
  it('starts in orbit, 3.25 earth radii out, looking at the middle of the earth', () => {
    const pose = storm.cameraPose(0)
    expect(length(pose.eye)).toBeCloseTo(3.25, 6)
    expect(pose.look).toEqual([0, 0, 0])
    expect(length(pose.up)).toBeCloseTo(1, 9)
    // north is up, until it dives
    expect(pose.up[1]).toBeCloseTo(1, 9)
  })

  it('has dived to just over the surface when the dive ends at 2.6 s, looking at the Gulf, up to its own sky', () => {
    const pose = storm.cameraPose(2.6)
    expect(length(pose.eye)).toBeCloseTo(1.125, 3)
    expect(length(pose.look)).toBeCloseTo(1, 6)
    // up is away from the earth's middle, as the camera lies on it
    const eye = pose.eye
    const along = pose.up[0] * eye[0] + pose.up[1] * eye[1] + pose.up[2] * eye[2]
    expect(along / length(eye)).toBeCloseTo(1, 9)
  })

  it('is one move through the dive’s end, with no jump', () => {
    const before = storm.cameraPose(2.6 - 1e-6)
    const after = storm.cameraPose(2.6)
    expect(length(sub(before.eye, after.eye))).toBeLessThan(1e-3)
    expect(length(sub(before.look, after.look))).toBeLessThan(1e-3)
    expect(length(sub(before.up, after.up))).toBeLessThan(1e-3)
  })

  it('comes down over the storm and tightens on it: nearer the earth, never inside it', () => {
    const radii = seconds.map((t) => length(storm.cameraPose(t).eye))
    expect(Math.min(...radii)).toBeGreaterThan(1.1)
    // the dive only ever comes in, and the track after it only a little nearer
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i] as number).toBeLessThanOrEqual((radii[i - 1] as number) + 1e-9)
    }
    expect(radii[radii.length - 1]).toBeCloseTo(1.125 - 0.012, 3)
  })

  it('keeps its up a unit vector throughout', () => {
    for (const t of seconds) {
      expect(length(storm.cameraPose(t).up)).toBeCloseTo(1, 9)
    }
  })

  it('holds still from the storm\'s landfall on: past 9 s the camera is where it was', () => {
    expect(storm.cameraPose(13)).toEqual(storm.cameraPose(9))
    expect(storm.cameraPose(20)).toEqual(storm.cameraPose(9))
  })
})

describe('the labels', () => {
  const at = (t: number) => storm.viewOf(storm.cameraPose(t), W / H)

  it('find what the camera looks at in the middle of the canvas, at any aspect', () => {
    for (const t of [0, 1.3, 2.6, 5, 9.3, 13]) {
      for (const [width, height] of [[840, 306], [600, 600], [1432, 806]] as [number, number][]) {
        const view = storm.viewOf(storm.cameraPose(t), width / height)
        const centre = storm.screenPoint(storm.cameraPose(t).look, view, width, height)
        expect(centre.x).toBeCloseTo(width / 2, 4)
        expect(centre.y).toBeCloseTo(height / 2, 4)
      }
    }
  })

  it('see the side of the earth the camera faces, and not the far side', () => {
    const t = 5
    const look = storm.cameraPose(t).look
    const near = storm.screenPoint(look, at(t), W, H)
    expect(near.on).toBe(true)
    const far = storm.screenPoint(look.map((c) => -c) as Vec, at(t), W, H)
    expect(far.on).toBe(false)
  })

  it('put the track’s end to the right of its start as the storm goes from left to right, and above it', () => {
    const t = 5
    const start = storm.screenPoint(storm.trackAt(0, 1.006), at(t), W, H)
    const end = storm.screenPoint(storm.trackAt(1, 1.006), at(t), W, H)
    expect(end.x).toBeGreaterThan(start.x)
    expect(end.y).toBeLessThan(start.y + 1)
  })

  it('count y down from the top of the canvas, x from its left', () => {
    const view = at(5)
    const aboveLook = storm.cameraPose(5).look
    // a point a little way from the look point along the camera's own up appears above the middle
    const up = storm.cameraPose(5).up
    const higher = [aboveLook[0] + up[0] * 0.05, aboveLook[1] + up[1] * 0.05, aboveLook[2] + up[2] * 0.05] as Vec
    expect(storm.screenPoint(higher, view, W, H).y).toBeLessThan(H / 2)
  })

  it('leave a point behind the camera off', () => {
    const t = 5
    const pose = storm.cameraPose(t)
    // the eye pushed on beyond itself is behind the lens
    const behind = pose.eye.map((c) => c * 1.5) as Vec
    expect(storm.screenPoint(behind, at(t), W, H).on).toBe(false)
  })
})

describe('the storm', () => {
  it('waits at the start of its track through the dive, then crosses it to the coast by 9 s, and stays there', () => {
    expect(storm.stormPose(0).s).toBe(0)
    expect(storm.stormPose(2.6).s).toBe(0)
    expect(storm.stormPose(5).s).toBeGreaterThan(0)
    expect(storm.stormPose(5).s).toBeLessThan(0.5)
    expect(storm.stormPose(9).s).toBe(1)
    expect(storm.stormPose(13).s).toBe(1)
  })

  it('goes faster as it goes, and grows', () => {
    const a = storm.stormPose(4).s - storm.stormPose(3).s
    const b = storm.stormPose(9).s - storm.stormPose(8).s
    expect(b).toBeGreaterThan(a)
    expect(storm.stormPose(2.6).scale).toBeCloseTo(0.026, 9)
    expect(storm.stormPose(9).scale).toBeCloseTo(0.026 + 0.042, 9)
  })

  it('lies on the earth along its track, turned so its sheet faces away from the earth’s middle', () => {
    for (const t of [3, 6, 9]) {
      const pose = storm.stormPose(t)
      expect(length(pose.position)).toBeCloseTo(1.0008, 6)
      // the sheet's face is +z; its turn takes it to the outward direction
      const [x, y, z, w] = pose.turn
      const faceX = 2 * (x * z + w * y)
      const faceY = 2 * (y * z - w * x)
      const faceZ = 1 - 2 * (x * x + y * y)
      const out = pose.position.map((c) => c / length(pose.position))
      expect(faceX).toBeCloseTo(out[0] as number, 6)
      expect(faceY).toBeCloseTo(out[1] as number, 6)
      expect(faceZ).toBeCloseTo(out[2] as number, 6)
    }
  })

  it('forms during the dive and turns half a turn a second of the timeline', () => {
    expect(storm.stormPose(1).formed).toBe(0)
    expect(storm.stormPose(2.1).formed).toBe(0)
    expect(storm.stormPose(3.1).formed).toBe(1)
    expect(storm.stormPose(4).spin).toBe(2)
    expect(storm.stormPose(13).spin).toBe(6.5)
  })

  it('flashes at landfall only: about 0.47 at 9.3 s, 0.05 at 9.4 s, and nothing past 10.8 s', () => {
    expect(storm.stormPose(9).flash).toBe(0)
    expect(storm.stormPose(5).flash).toBe(0)
    expect(storm.stormPose(9.3).flash).toBeCloseTo(0.47, 2)
    expect(storm.stormPose(9.4).flash).toBeCloseTo(0.05, 2)
    expect(storm.stormPose(10.9).flash).toBe(0)
    expect(storm.stormPose(13).flash).toBe(0)
  })

  it('casts its shadow flat on the sea, a little off the earth, away from the sun', () => {
    const pose = storm.stormPose(6)
    expect(pose.shadow[2]).toBe(0.0005)
    expect(Math.hypot(pose.shadow[0], pose.shadow[1])).toBeCloseTo(0.42, 2)
  })
})
