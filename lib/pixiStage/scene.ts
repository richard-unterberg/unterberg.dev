import type { PathDefinition, PlayOptions } from './pathPlayer'

type Range = [number, number]
export type PageScene = {
  paths?: Record<string, PathDefinition>
  play?: PlayOptions & { name: string }
  comet?: { curvature?: Range }
}

export const pick = ([low, high]: Range) => low + Math.random() * (high - low)
const range = (value: Range | undefined, fallback: Range, min: number, max: number): Range => {
  if (value?.length !== 2 || !value.every(Number.isFinite)) return fallback
  const sorted = value.map((n) => Math.max(min, Math.min(max, n))).sort((a, b) => a - b)
  return [sorted[0], sorted[1]]
}
export const cometOptions = (scene: PageScene) => ({
  curvature: range(scene.comet?.curvature, [0.06, 0.18], 0, 0.25),
})

export const cometPath = (width: number, height: number, curvature: Range): PathDefinition => {
  const entry = Math.floor(Math.random() * 4)
  const exit = (entry + 1 + Math.floor(Math.random() * 3)) % 4
  const margin = 32
  // Keep both endpoints away from corners, on one unambiguous, slightly offscreen edge.
  const edge = (side: number) => {
    const t = pick([0.2, 0.8])
    return side === 0
      ? [width * t, -margin]
      : side === 1
        ? [width + margin, height * t]
        : side === 2
          ? [width * t, height + margin]
          : [-margin, height * t]
  }
  const [x, y] = edge(entry)
  const [endX, endY] = edge(exit)
  const dx = endX - x,
    dy = endY - y
  const length = Math.hypot(dx, dy)
  // Adjacent edges bow inward so a flight near a corner still enters the viewport.
  const inward = -dy * (width / 2 - (x + endX) / 2) + dx * (height / 2 - (y + endY) / 2)
  const sign = (exit - entry + 4) % 4 === 2 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(inward)
  const bow = pick(curvature) * Math.min(width, height) * sign
  const bx = (-dy / length) * bow,
    by = (dx / length) * bow
  return {
    d: `M${x},${y} C${x + dx / 3 + bx},${y + dy / 3 + by} ${x + (dx * 2) / 3 + bx},${y + (dy * 2) / 3 + by} ${endX},${endY}`,
    viewBox: [0, 0, width, height],
  }
}
