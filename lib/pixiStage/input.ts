import type { StageConfig } from './config'
import { createPathPlayer, type MotionSample, type PlayOptions } from './pathPlayer'
import { cometOptions, cometPath, type PageScene, pick } from './scene'
import { createZones } from './zones'

export const createInput = (config: StageConfig) => {
  const listeners = new AbortController()
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)')
  const pointer = { x: 0, y: 0, time: -Infinity, present: false, seen: false, version: 0 }
  const sample: MotionSample = { x: 0, y: 0, vx: 0, vy: 0, generation: 0 }
  const player = createPathPlayer()
  const zones = createZones()
  let scene: PageScene = {}
  let options = cometOptions(scene)
  let page = false
  let consumed = 0
  let sampledAt = 0
  let source = ''
  let pathGeneration = -1
  let wait: number | undefined
  let angle = 0
  let centerX = 0
  let centerY = 0

  const cancel = () => {
    player.cancel()
    wait = undefined
  }
  const reset = () => {
    cancel()
    source = ''
    consumed = pointer.version
    pointer.time = -Infinity
    sample.generation++
  }
  // Freeze playback and its launch clock while the ticker is paused; discard emission continuity.
  const pause = () => {
    consumed = pointer.version
    pointer.present = false
    pointer.time = -Infinity
    sample.generation++
  }
  const leave = () => {
    pointer.present = false
    reset()
  }
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || (!finePointer.matches && event.pointerType !== 'pen')) return
      if (!pointer.present) reset()
      if (source !== 'pointer') {
        cancel()
        source = ''
      }
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.time = performance.now()
      pointer.present = pointer.seen = true
      pointer.version++
    },
    { passive: true, signal: listeners.signal },
  )
  document.addEventListener(
    'pointerout',
    (event) => {
      if (!event.relatedTarget) leave()
    },
    { signal: listeners.signal },
  )
  window.addEventListener('blur', pause, { signal: listeners.signal })
  window.addEventListener(
    'resize',
    () => {
      zones.markDirty()
      reset()
    },
    { signal: listeners.signal },
  )
  document.addEventListener(
    'visibilitychange',
    () => {
      pause()
      zones.markDirty()
    },
    { signal: listeners.signal },
  )

  function unbindPage() {
    page = false
    zones.unbind()
    reset()
    player.setPaths({})
  }
  return {
    bindPage(next: PageScene = {}) {
      unbindPage()
      scene = next
      options = cometOptions(scene)
      player.setPaths(scene.paths ?? {})
      zones.bind()
      page = true
    },
    unbindPage,
    reset,
    pause,
    resize(width: number, height: number) {
      if (player.resize(width, height)) reset()
      zones.markDirty()
    },
    playPath(name: string, playback: PlayOptions) {
      if (
        !page ||
        !config.animation ||
        !config.autoplay ||
        (pointer.present && performance.now() - pointer.time < config.idleDelay)
      )
        return false
      wait = undefined
      const started = player.playPath(name, playback)
      source = started ? 'path' : ''
      sample.generation++
      return started
    },
    zoneAt: zones.at,
    update(now: number, dt: number, width: number, height: number): MotionSample | null {
      if (!page) return null
      zones.update()
      const pending = pointer.version !== consumed && pointer.present
      const next =
        pointer.present && (pending || now - pointer.time < config.idleDelay)
          ? 'pointer'
          : config.autoplay
            ? player.playing && source === 'path'
              ? 'path'
              : config.autoplayMode
            : ''
      if (!next) {
        if (source) reset()
        return null
      }
      const switched = next !== source
      if (switched) {
        cancel()
        source = next
        sample.generation++
        angle = 0
        const rx = Math.min(config.orbitSize, width / 3, height / 3)
        const ry = rx * 0.6
        centerX = Math.max(rx, Math.min(width - rx, pointer.seen ? pointer.x - rx : width / 2))
        centerY = Math.max(ry, Math.min(height - ry, pointer.seen ? pointer.y : height / 2))
      }
      if (next === 'comet' || next === 'path') {
        if (next === 'comet') {
          if (wait === undefined) wait = pick(options.interval)
          else wait -= dt
          if (!player.playing && wait <= 0) {
            player.play(cometPath(width, height, options.curvature), { duration: pick(options.duration) })
            // Sample at launch: start-to-start, but do not launch again until this player completes.
            wait = pick(options.interval)
            dt = 0
          }
        }
        const point = player.update(dt)
        if (!point) return null
        if (point.generation !== pathGeneration) {
          sample.generation++
          pathGeneration = point.generation
        }
        return { ...point, generation: sample.generation }
      }
      let x: number, y: number, elapsed: number
      if (next === 'pointer') {
        x = pointer.x
        y = pointer.y
        elapsed = (pointer.time - sampledAt) / 1000
        sampledAt = pointer.time
        consumed = pointer.version
      } else {
        angle += dt * config.autoplaySpeed
        const radius = Math.min(config.orbitSize, width / 3, height / 3)
        x = centerX + Math.cos(angle) * radius
        y = centerY + Math.sin(angle) * radius * 0.6
        elapsed = dt
      }
      sample.vx = switched || elapsed <= 0 ? 0 : Math.max(-2000, Math.min(2000, (x - sample.x) / elapsed))
      sample.vy = switched || elapsed <= 0 ? 0 : Math.max(-2000, Math.min(2000, (y - sample.y) / elapsed))
      sample.x = x
      sample.y = y
      return sample
    },
    dispose() {
      unbindPage()
      listeners.abort()
    },
  }
}
