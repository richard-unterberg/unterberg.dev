import { bindControls } from './controls'
import type { createStage } from './runtime'
import type { PageScene } from './scene'

const lifetime = new AbortController()
const motion = matchMedia('(prefers-reduced-motion: reduce)')
let stage: Awaited<ReturnType<typeof createStage>> | undefined
let pending: Promise<void> | undefined
let disposeControls: (() => void) | undefined
let boundMain: Element | null = null
let swapping = false
let autoplayOverride = false

const bindPage = () => {
  if (!stage || swapping || lifetime.signal.aborted) return
  const main = document.querySelector('main')
  if (main === boundMain) return
  disposeControls?.()
  const definition = main?.querySelector<HTMLElement>('[data-pixi-scene]')?.dataset.pixiScene
  let scene: PageScene = {}
  if (definition) {
    try {
      scene = JSON.parse(definition) as PageScene
    } catch (error) {
      console.error('Invalid Pixi scene configuration', error)
    }
  }
  stage.bindPage(scene)
  const current = stage
  disposeControls = bindControls(current.config, (next) => {
    if (next.autoplay !== current.config.autoplay) autoplayOverride = true
    current.update(next)
  })
  boundMain = main
}
const start = async () => {
  if (lifetime.signal.aborted) return
  if (stage) {
    bindPage()
    return
  }
  if (pending) return pending
  const host = document.getElementById('pixi-stage')
  if (!host) return
  pending = (async () => {
    const { createStage } = await import('./runtime')
    if (lifetime.signal.aborted) return
    const current = await createStage(host, lifetime.signal)
    if (lifetime.signal.aborted) {
      current.dispose()
      return
    }
    stage = current
    current.update({ ...current.config, autoplay: !motion.matches })
    bindPage()
  })()
    .catch((error) => {
      if (!lifetime.signal.aborted) console.error('Pixi stage initialization failed', error)
    })
    .finally(() => {
      pending = undefined
    })
  return pending
}
document.addEventListener(
  'astro:before-swap',
  () => {
    swapping = true
    disposeControls?.()
    disposeControls = undefined
    stage?.unbindPage()
    boundMain = null
  },
  { signal: lifetime.signal },
)
document.addEventListener(
  'astro:after-swap',
  () => {
    swapping = false
    void start()
  },
  { signal: lifetime.signal },
)
document.addEventListener(
  'astro:page-load',
  () => {
    void start()
  },
  { signal: lifetime.signal },
)
motion.addEventListener(
  'change',
  () => {
    if (!stage || autoplayOverride) return
    stage.update({ ...stage.config, autoplay: !motion.matches })
    boundMain = null
    bindPage()
  },
  { signal: lifetime.signal },
)

const dispose = () => {
  lifetime.abort()
  disposeControls?.()
  stage?.dispose()
  stage = undefined
  boundMain = null
}
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) dispose()
  },
  { signal: lifetime.signal },
)
const hot = (import.meta as ImportMeta & { hot?: { dispose(callback: () => void): void } }).hot
hot?.dispose(dispose)
void start()
