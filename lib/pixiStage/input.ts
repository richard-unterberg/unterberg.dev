import type { StageConfig } from './config'

type Zone = { bounds: DOMRect; dead: boolean }

export const createInput = (config: StageConfig) => {
  const listeners = new AbortController()
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)')
  const pointer = { x: 0, y: 0, time: -Infinity, present: false, seen: false, version: 0 }
  const sample = { x: 0, y: 0, vx: 0, vy: 0, generation: 0 }
  let consumed = 0
  let sampledAt = 0
  let source = ''
  let angle = 0
  let centerX = 0
  let centerY = 0
  let page: AbortController | undefined
  let observer: ResizeObserver | undefined
  let mutation: MutationObserver | undefined
  let elements: Element[] = []
  let zones: Zone[] = []
  let dirty = true
  let discover = true

  const reset = () => {
    source = ''
    consumed = pointer.version
    pointer.time = -Infinity
    sample.generation++
  }
  const leave = () => {
    pointer.present = false
    reset()
  }
  const markDirty = () => {
    dirty = true
  }
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || (!finePointer.matches && event.pointerType !== 'pen')) return
      if (!pointer.present) reset()
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
  window.addEventListener('blur', leave, { signal: listeners.signal })
  window.addEventListener(
    'resize',
    () => {
      markDirty()
      reset()
    },
    { signal: listeners.signal },
  )
  document.addEventListener(
    'visibilitychange',
    () => {
      reset()
      markDirty()
    },
    { signal: listeners.signal },
  )

  function unbindPage() {
    page?.abort()
    observer?.disconnect()
    mutation?.disconnect()
    page = undefined
    elements = []
    zones = []
    consumed = pointer.version
    sample.generation++
  }
  function bindPage() {
    unbindPage()
    page = new AbortController()
    const main = document.querySelector('main')
    observer = new ResizeObserver(markDirty)
    observer.observe(document.body)
    if (main) observer.observe(main)
    mutation = new MutationObserver(() => {
      discover = dirty = true
    })
    if (main) mutation.observe(main, { subtree: true, childList: true, attributes: true, characterData: true })
    document.addEventListener('scroll', markDirty, { capture: true, passive: true, signal: page.signal })
    document.addEventListener('load', markDirty, { capture: true, signal: page.signal })
    document.fonts.addEventListener('loadingdone', markDirty, { signal: page.signal })
    const binding = page
    void document.fonts.ready.then(() => {
      if (!binding.signal.aborted) markDirty()
    })
    discover = dirty = true
  }

  return {
    bindPage,
    unbindPage,
    reset,
    zoneAt(x: number, y: number) {
      let soft = 0
      for (const { bounds: b, dead } of zones) {
        if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
          if (dead) return -1
          soft = 1
        }
      }
      return soft
    },
    update(now: number, dt: number, width: number, height: number) {
      if (!page) return null
      if (dirty) {
        if (discover) {
          observer?.disconnect()
          observer?.observe(document.body)
          const main = document.querySelector('main')
          if (main) observer?.observe(main)
          elements = [
            ...document.querySelectorAll('.pixi-hitbox, .pixi-deadzone, [data-pixi-hitbox], [data-pixi-deadzone]'),
          ]
          for (const element of elements) observer?.observe(element)
          discover = false
        }
        zones = elements.map((element) => ({
          bounds: element.getBoundingClientRect(),
          dead: element.matches('.pixi-deadzone, [data-pixi-deadzone]'),
        }))
        dirty = false
      }
      const pending = pointer.version !== consumed && pointer.present
      const next =
        pointer.present && (pending || now - pointer.time < config.idleDelay)
          ? 'pointer'
          : config.autoplay
            ? 'auto'
            : ''
      if (!next) {
        source = ''
        return null
      }
      const switched = next !== source
      if (switched) {
        source = next
        sample.generation++
        angle = 0
        centerX = pointer.seen ? pointer.x - Math.min(config.orbitSize, width / 3, height / 3) : width / 2
        centerY = pointer.seen ? pointer.y : height / 2
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
        x = Math.max(0, Math.min(width, centerX + Math.cos(angle) * radius))
        y = Math.max(0, Math.min(height, centerY + Math.sin(angle) * radius * 0.6))
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
