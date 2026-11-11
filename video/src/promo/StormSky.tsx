// The sky over KLWD's tower, drawn on the GPU for each frame from the time
// alone: night, storm clouds rolling in from the left and building as they
// come, lit from inside by the lightning and from below by the city, and the
// rain in front of everything. As the storm clears the clouds thin and part
// and the icon's own dusk comes up behind them, so the last picture is the
// icon's sky. The sky is placed in the icon's units (1024 to the tile, y down)
// and seen through the same camera as the city; the rain falls on the lens.
import { useLayoutEffect, useRef } from 'react'

export interface Light {
  /** Where, in the icon's units */
  x: number
  y: number
  /** How bright now, 0 is dark */
  i: number
  /** How far it reaches, in the icon's units */
  r: number
}

export interface SkyProps {
  width: number
  height: number
  /** Seconds, for the clouds' drift and the rain */
  t: number
  /** The camera: the icon's point at the middle of the frame, and pixels per unit */
  cam: { x: number; y: number; s: number }
  /** Up to four lights in the clouds */
  lights: Light[]
  /** 0 the storm, 1 the icon's clear dusk */
  clear: number
  /** How hard it rains, 0 to 1 */
  rain: number
  /** 'sky' draws the sky and clouds; 'rain' only the rain, over everything else */
  layer: 'sky' | 'rain'
  /** The icon's tile on the screen, in pixels, with its corner radius: outside it nothing is drawn. Omitted: the whole frame. */
  tile?: { x0: number; y0: number; x1: number; y1: number; r: number }
}

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uCam;
uniform vec4 uLight[4];
uniform float uClear;
uniform float uRain;
uniform int uLayer;
uniform vec4 uTile;
uniform float uTileR;
uniform float uTileOn;
out vec4 outColor;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 6; k++) {
    v += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 0.0);
    a *= 0.5;
  }
  return v;
}

// The icon's dusk: deep blue at the top, then violet, then coral at the horizon (assets/icon-layers/sky.svg)
vec3 dusk(float y) {
  vec3 c0 = vec3(0.043, 0.114, 0.302);
  vec3 c1 = vec3(0.227, 0.176, 0.455);
  vec3 c2 = vec3(0.851, 0.447, 0.361);
  float g = clamp(y / 1024.0, 0.0, 1.0);
  return g < 0.6 ? mix(c0, c1, g / 0.6) : mix(c1, c2, (g - 0.6) / 0.4);
}

// The cloud deck's density at a point of the icon: rolling in from the left as it builds
float deck(vec2 w, float t, float cover) {
  vec3 p = vec3(w / 360.0, t * 0.05);
  p.x -= t * 0.075;
  vec3 q = vec3(fbm(p + vec3(0.0, 0.0, 0.0)), fbm(p + vec3(5.2, 1.3, 2.0)), 0.0);
  float d = fbm(p + 1.4 * q + vec3(0.0, 0.0, t * 0.02));
  // Thicker high up, thinning towards the city
  float high = smoothstep(1150.0, 250.0, w.y);
  return smoothstep(cover, cover + 0.22, d * (0.72 + 0.5 * high));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float inside = 1.0;
  if (uTileOn > 0.5) {
    vec2 c = (uTile.xy + uTile.zw) * 0.5;
    vec2 hsz = (uTile.zw - uTile.xy) * 0.5;
    vec2 q = abs(frag - c) - hsz + vec2(uTileR);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uTileR;
    inside = clamp(0.5 - sd, 0.0, 1.0);
  }
  if (uLayer == 1) {
    // The rain, falling on the lens in three depths, slanting with the wind
    float a = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 cell = vec2(14.0 + 10.0 * fk, 150.0 + 90.0 * fk);
      vec2 uv = frag / cell;
      uv.x += uv.y * cell.y * (0.13 + 0.02 * fk) / cell.x;
      uv.y -= uT * (9.0 - 2.2 * fk);
      vec2 id = floor(uv);
      vec2 f = fract(uv);
      float h = hash2(id + fk * 31.7);
      float on = step(1.0 - uRain * (0.42 - 0.08 * fk), h);
      float x0 = 0.2 + 0.6 * hash2(id + 7.3);
      float len = 0.35 + 0.3 * hash2(id + 3.1);
      float head = 0.15 + 0.7 * hash2(id + 11.9);
      float along = (head - f.y) / len;
      float streak = smoothstep(0.0, 0.15, along) * smoothstep(1.0, 0.3, along) * step(0.0, along) * step(along, 1.0);
      float across = 1.0 - smoothstep(0.0, 0.09 + 0.04 * fk, abs(f.x - x0));
      a += on * streak * across * (0.22 - 0.05 * fk);
    }
    float lit = 0.0;
    for (int k = 0; k < 4; k++) { lit += uLight[k].z; }
    vec3 col = mix(vec3(0.55, 0.62, 0.78), vec3(0.95, 0.97, 1.0), clamp(lit, 0.0, 1.0));
    a = clamp(a * (1.0 + 1.5 * clamp(lit, 0.0, 1.0)), 0.0, 0.8) * inside;
    outColor = vec4(col * a, a);
    return;
  }

  vec2 w = (frag - uRes * 0.5) / uCam.z + uCam.xy;
  // The storm's night sky, and the dusk it clears to
  float g = clamp(w.y / 1024.0, 0.0, 1.0);
  vec3 night = mix(vec3(0.008, 0.016, 0.05), vec3(0.03, 0.04, 0.10), g);
  // The city's glow on the haze above it
  night += vec3(0.16, 0.07, 0.05) * smoothstep(560.0, 1024.0, w.y) * 0.5;
  vec3 skyCol = mix(night, dusk(w.y), uClear);

  // As it clears the deck thins and parts from the left, the way it came
  float part = smoothstep(0.0, 1.0, uClear * 1.6 - (w.x + 300.0) / 2000.0);
  float cover = mix(0.33, 0.95, part);
  float d = deck(w, uT, cover);
  // Light from above: where the deck thins upwards, its tops catch it
  float up = deck(w + vec2(0.0, -46.0), uT, cover);
  float tops = clamp((d - up) * 2.4 + 0.3, 0.0, 1.0);

  vec3 base = vec3(0.022, 0.035, 0.085);
  vec3 lift = vec3(0.13, 0.16, 0.26);
  vec3 cloud = mix(base, lift, tops * 0.75);
  // Undersides warmed by the city
  cloud += vec3(0.18, 0.08, 0.06) * smoothstep(380.0, 900.0, w.y) * (1.0 - tops) * 0.7;
  // Clearing: what is left of the deck catches the dusk
  cloud = mix(cloud, mix(dusk(w.y) * 0.75, vec3(0.98, 0.72, 0.62), tops * 0.4), uClear);

  // Lightning inside the clouds, and its light on the sky
  vec3 flash = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec4 L = uLight[k];
    if (L.z <= 0.0) { continue; }
    float dist = length(w - L.xy);
    float glow = exp(-dist / L.w);
    flash += L.z * glow * vec3(0.78, 0.84, 1.0);
  }
  vec3 col = mix(skyCol + flash * 0.25, cloud + flash * (0.55 + 1.1 * d) * (0.6 + 0.6 * tops), d);
  // A little grain, as a 90s camera has
  col += (hash2(frag + fract(uT * 13.0) * 100.0) - 0.5) * 0.012;
  outColor = vec4(col * inside, inside);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`StormSky shader: ${gl.getShaderInfoLog(sh) ?? ''}`)
  }
  return sh
}

interface Gl {
  gl: WebGL2RenderingContext
  loc: (name: string) => WebGLUniformLocation | null
}

function setup(canvas: HTMLCanvasElement): Gl {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true })
  if (!gl) throw new Error('StormSky: no WebGL 2')
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`StormSky: ${gl.getProgramInfoLog(prog) ?? ''}`)
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(a)
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  const cache = new Map<string, WebGLUniformLocation | null>()
  return {
    gl,
    loc: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name))
      return cache.get(name)!
    },
  }
}

export function StormSky({ width, height, t, cam, lights, clear, rain, layer, tile }: SkyProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ctx = useRef<Gl | null>(null)

  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (ctx.current === null) ctx.current = setup(canvas)
    const { gl, loc } = ctx.current
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(loc('uRes'), canvas.width, canvas.height)
    gl.uniform1f(loc('uT'), t)
    // The canvas may be drawn larger than the frame (a 4K render): the camera's scale follows it
    const k = canvas.width / width
    gl.uniform3f(loc('uCam'), cam.x, cam.y, cam.s * k)
    const flat = new Float32Array(16)
    lights.slice(0, 4).forEach((l, i) => flat.set([l.x, l.y, l.i, l.r], i * 4))
    gl.uniform4fv(loc('uLight[0]'), flat)
    gl.uniform1f(loc('uClear'), clear)
    gl.uniform1f(loc('uRain'), rain)
    gl.uniform1i(loc('uLayer'), layer === 'rain' ? 1 : 0)
    gl.uniform1f(loc('uTileOn'), tile ? 1 : 0)
    if (tile) {
      gl.uniform4f(loc('uTile'), tile.x0 * k, tile.y0 * k, tile.x1 * k, tile.y1 * k)
      gl.uniform1f(loc('uTileR'), tile.r * k)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  })

  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, width, height }} />
}
