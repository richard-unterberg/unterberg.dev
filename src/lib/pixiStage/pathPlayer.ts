import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(MotionPathPlugin)

export type PathDefinition = {
  d: string
  // Stretched to the viewport in CSS pixels; measured AFTER scaling, including nonuniform scaling.
  viewBox: [number, number, number, number]
}
export type PlayOptions = { ease?: string } & ({ duration: number } | { speed: number }) // seconds or CSS px/s
type Point = { x: number; y: number; vx: number; vy: number }
export type MotionSample = Point & {
  generation: number
  travel?: { distance: number; at: (fraction: number) => Point }
}
type RawPath = ReturnType<typeof MotionPathPlugin.stringToRawPath>
type Geometry = { parts: { raw: RawPath; length: number; start: number }[]; length: number }

// Only validate command syntax here; all SVG geometry (including arcs) is parsed by GSAP.
const validData = (d: string) => {
  const tokens = d.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []
  if (tokens.join('') !== d.replace(/[\s,]/g, '') || tokens[0]?.toUpperCase() !== 'M') return false
  const arities: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
  for (let i = 0; i < tokens.length; ) {
    const command = tokens[i++].toUpperCase()
    const arity = arities[command]
    if (arity === undefined) return false
    const start = i
    while (i < tokens.length && Number.isFinite(Number(tokens[i]))) i++
    const count = i - start
    if (arity === 0 ? count !== 0 : count === 0 || count % arity !== 0) return false
    if (command === 'A') {
      for (let j = start; j < i; j += 7) {
        if (
          Number(tokens[j]) < 0 ||
          Number(tokens[j + 1]) < 0 ||
          !['0', '1'].includes(tokens[j + 3]) ||
          !['0', '1'].includes(tokens[j + 4])
        )
          return false
      }
    }
  }
  return true
}

const measure = ({ d, viewBox: [left, top, w, h] }: PathDefinition, width: number, height: number): Geometry | null => {
  if (
    ![left, top, w, h, width, height].every(Number.isFinite) ||
    w <= 0 ||
    h <= 0 ||
    width <= 0 ||
    height <= 0 ||
    !validData(d)
  )
    return null
  try {
    const parsed = MotionPathPlugin.stringToRawPath(d)
    const parts: Geometry['parts'] = []
    let length = 0
    for (const segment of parsed) {
      if (segment.length < 8 || !segment.every(Number.isFinite)) return null
      const scaled = segment.map((value, i) => (i % 2 ? ((value - top) * height) / h : ((value - left) * width) / w))
      // GSAP's bundled declaration omits the measurement metadata present on RawPath.
      const raw = MotionPathPlugin.cacheRawPathMeasurements([scaled], 48) as RawPath & { totalLength: number }
      const size = raw.totalLength
      if (!Number.isFinite(size) || size <= 0) return null
      parts.push({ raw, length: size, start: length })
      length += size
    }
    return parts.length ? { parts, length } : null
  } catch {
    return null
  }
}

export const createPathPlayer = () => {
  let paths: Record<string, PathDefinition> = {}
  const cache = new Map<string, Geometry | null>()
  let width = 0,
    height = 0,
    generation = 0
  let flight:
    | {
        geometry: Geometry
        duration: number
        elapsed: number
        distance: number
        part: number
        ease: (t: number) => number
      }
    | undefined
  const cancel = () => {
    flight = undefined
    generation++
  }
  const start = (geometry: Geometry | null, options: PlayOptions) => {
    cancel()
    if (!geometry) return false
    const duration = 'speed' in options ? geometry.length / options.speed : options.duration
    if (!Number.isFinite(duration) || duration <= 0) return false
    flight = {
      geometry,
      duration,
      elapsed: 0,
      distance: 0,
      part: 0,
      ease: gsap.parseEase(options.ease ?? 'none') ?? gsap.parseEase('none'),
    }
    return true
  }
  return {
    cancel,
    get playing() {
      return !!flight
    },
    setPaths(next: Record<string, PathDefinition>) {
      cancel()
      paths = next
      cache.clear()
    },
    resize(w: number, h: number) {
      if (w === width && h === height) return false
      width = w
      height = h
      cache.clear()
      cancel()
      return true
    },
    playPath(name: string, options: PlayOptions) {
      if (!cache.has(name)) cache.set(name, Object.hasOwn(paths, name) ? measure(paths[name], width, height) : null)
      return start(cache.get(name) ?? null, options)
    },
    // Ephemeral generated paths never accumulate in the named-path cache.
    play(definition: PathDefinition, options: PlayOptions) {
      return start(measure(definition, width, height), options)
    },
    update(dt: number): MotionSample | null {
      if (!flight) return null
      const f = flight
      f.elapsed = Math.min(f.duration, f.elapsed + Math.max(0, dt))
      const eased = f.ease(f.elapsed / f.duration)
      if (!Number.isFinite(eased)) {
        cancel()
        return null
      }
      const distance = Math.max(0, Math.min(1, eased)) * f.geometry.length
      let index = f.geometry.parts.length - 1
      while (index > 0 && distance < f.geometry.parts[index].start) index--
      const part = f.geometry.parts[index]
      const changed = index !== f.part
      if (changed) generation++
      const from = changed ? (distance >= f.distance ? 0 : part.length) : f.distance - part.start
      const to = distance - part.start
      const delta = to - from
      const speed = dt > 0 ? delta / dt : 0
      const at = (fraction: number): Point => {
        const position = MotionPathPlugin.getPositionOnPath(
          part.raw,
          Math.max(0, Math.min(1, (from + delta * fraction) / part.length)),
          true,
        ) as gsap.plugins.getRelativePositionObject
        const angle = (position.angle * Math.PI) / 180
        return {
          x: position.x,
          y: position.y,
          vx: Math.max(-2000, Math.min(2000, Math.cos(angle) * speed)),
          vy: Math.max(-2000, Math.min(2000, Math.sin(angle) * speed)),
        }
      }
      f.distance = distance
      f.part = index
      const sample = { ...at(1), generation, travel: { distance: Math.abs(delta), at } }
      if (f.elapsed >= f.duration) flight = undefined
      return sample
    },
  }
}
