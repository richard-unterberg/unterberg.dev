import gsap from 'gsap'
import { Application, Assets, Container, Sprite, type Spritesheet, type Texture } from 'pixi.js'
import { createClouds } from './clouds'
import { createConfig, normalizeConfig, type StageConfig } from './config'
import { createInput } from './input'

type Tile = {
  sprite: Sprite
  age: number
  entrance: number
  exit: number
  delay: number
  life: number
  fadeFrom: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  dx: number
  dy: number
  scale: number
  alpha: number
  skewFrom: number
  skewTo: number
  rotation: number
}
const random = (low: number, high: number) => low + Math.random() * (high - low)
const pick = (range: [number, number]) => random(range[0], range[1])
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
// Legacy "power.in"/"power.inOut" are unregistered in GSAP 3.15 and fall back to power1.out.
const easeOut = gsap.parseEase('power1.out')

export const createStage = async (host: HTMLElement, signal: AbortSignal) => {
  const config = createConfig(matchMedia('(prefers-reduced-motion: reduce)').matches)
  const app = new Application()
  const listeners = new AbortController()
  const urls = ['sun', 'moon'].map(
    (name) => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}pixi/${name}/spritesheet.json`,
  )
  const loaded: string[] = []
  const active: Tile[] = []
  const free: Tile[] = []
  let textures: Texture[] = []
  let input: ReturnType<typeof createInput> | undefined
  let clouds: ReturnType<typeof createClouds> | undefined
  let layer: Container | undefined
  let allocated = 0
  let disposed = false
  let width = 0
  let height = 0
  let cellSize = 24
  let resizePending = true
  let lastFrame = 0
  let previousGeneration = -1
  let previousX = 0
  let previousY = 0
  let spacingRemainder = 0
  let budget = 24
  let ambientIn = random(0.6, 4.5)
  let pageBound = false
  let scroller: Element | null = null
  let scrollLeft = 0
  let scrollTop = 0
  const tileScrollTarget = { x: 0, y: 0 }
  const cloudScrollTarget = { x: 0, y: 0 }

  function dispose() {
    if (disposed) return
    disposed = true
    gsap.ticker.remove(frame)
    listeners.abort()
    scroller = null
    input?.dispose()
    clouds?.dispose()
    active.length = free.length = 0
    if (app.renderer) app.destroy({ removeView: true }, { children: true })
    else app.stage.destroy({ children: true })
    void Promise.all(loaded.map((url) => Assets.unload(url))).catch((error) =>
      console.error('Pixi asset cleanup failed', error),
    )
    textures = []
  }
  function resize() {
    width = host.clientWidth
    height = host.clientHeight
    const divider = Math.max(15, Math.min(80, 15 + ((width - 500) * 65) / 1400))
    cellSize = Math.floor(width / divider)
    app.renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, config.resolutionCap))
    resizePending = false
  }
  function syncScroll() {
    if (!scroller) return
    const left = scroller.scrollLeft
    const top = scroller.scrollTop
    if (left === scrollLeft && top === scrollTop) return
    const dx = left - scrollLeft
    const dy = top - scrollTop
    tileScrollTarget.x += dx
    tileScrollTarget.y += dy
    // Apply live parallax to new scroll deltas so changing it never replays past scrolling.
    const parallax = config.cloudParallaxOffset / 100
    cloudScrollTarget.x += dx * parallax
    cloudScrollTarget.y += dy * parallax
    scrollLeft = left
    scrollTop = top
  }
  function followScroll(plane: Container, target: { x: number; y: number }, lag: number, dt: number) {
    // Exponential following stays consistent across refresh rates and continues after scrolling stops.
    const blend = lag === 0 ? 1 : -Math.expm1((-dt * 1000) / lag)
    const x = plane.x + (-target.x - plane.x) * blend
    const y = plane.y + (-target.y - plane.y) * blend
    plane.position.set(Math.abs(x + target.x) < 0.01 ? -target.x : x, Math.abs(y + target.y) < 0.01 ? -target.y : y)
  }
  function release(index: number, retire = false) {
    const tile = active[index]
    const last = active.pop()
    if (index < active.length && last) active[index] = last
    tile.sprite.visible = false
    if (retire) {
      tile.sprite.destroy()
      allocated--
    } else free.push(tile)
  }
  function spawn(x: number, y: number, vx: number, vy: number) {
    if (!input || !clouds || !layer || config.cursorRadius === 0) return
    const anchorZone = input.zoneAt(x, y)
    if (anchorZone < 0) return
    const size = cellSize
    const footprint = size * config.cursorRadius * 2
    const candidates = Math.ceil(config.cursorRadius * 2)
    // Express legacy pointer displacement at a fixed 60 Hz, independent of event/refresh rate.
    const movementX = Math.max(-50, Math.min(50, vx / 60))
    const movementY = Math.max(-50, Math.min(50, vy / 60))
    const worldX = x - layer.x
    const worldY = y - layer.y
    for (let i = 0; i < candidates; i++) {
      const targetX = x + movementX * config.pointerInertia + random(-footprint, footprint)
      const targetY = y + movementY * config.pointerInertia + random(-footprint, footprint)
      const angle = Math.atan2(targetY - y, targetX - x)
      const spread = pick(config.pixelSpread)
      const endX = targetX + Math.cos(angle) * spread
      const endY = targetY + Math.sin(angle) * spread
      if (endX < 0 || endY < 0 || endX > width || endY > height) continue
      const candidateZone = input.zoneAt(endX, endY)
      if (candidateZone < 0) continue
      const soft = anchorZone > 0 || candidateZone > 0
      if (Math.random() >= config.tailMissRate)
        clouds.spawn(endX - clouds.container.x, endY - clouds.container.y, vx, vy, config.tailOpacity, soft)
      if (Math.random() < config.pointerMissRate || active.length >= config.bufferCount) continue
      let tile = free.pop()
      const texture = textures[Math.floor(Math.random() * textures.length)]
      if (!tile) {
        const sprite = new Sprite({ texture, anchor: 0.5, eventMode: 'none' })
        layer.addChild(sprite)
        tile = {
          sprite,
          age: 0,
          entrance: 0,
          exit: 0,
          delay: 0,
          life: 0,
          fadeFrom: 1,
          x: 0,
          y: 0,
          offsetX: 0,
          offsetY: 0,
          dx: 0,
          dy: 0,
          scale: 0,
          alpha: 0,
          skewFrom: 0,
          skewTo: 0,
          rotation: 0,
        }
        allocated++
      }
      tile.sprite.texture = texture
      tile.sprite.visible = true
      tile.sprite.position.set(worldX, worldY)
      tile.sprite.scale.set(0)
      tile.sprite.alpha = 0
      tile.age = 0
      tile.x = worldX
      tile.y = worldY
      tile.offsetX = endX - x
      tile.offsetY = endY - y
      const momentum = config.pointerInertia * random(0.6, 1.1)
      tile.dx = soft ? 0 : movementX * momentum + random(-size, size)
      tile.dy = soft ? 0 : movementY * momentum + random(-size, size) + config.gravity * random(100, 200)
      tile.entrance = pick(config.inDuration)
      tile.exit = pick(config.outDuration)
      tile.delay = pick(config.outDelay)
      tile.life = Math.max(tile.entrance, tile.delay + tile.exit, tile.exit * 1.5)
      // The exit tween captures the current scale/alpha when it starts, including overlapping entrances.
      tile.fadeFrom = easeOut(clamp01((tile.exit * 0.5) / tile.entrance))
      // Fold the legacy inner container's uniform scale into the sprite transform.
      tile.scale =
        (size / (texture.width * 2)) * config.scaleModifier * pick(soft ? config.scaleHitboxIn : config.scaleIn)
      tile.alpha = pick(config.alphaIn) * (soft ? 0.3 : 1)
      tile.skewFrom = pick(config.skewFrom)
      tile.skewTo = pick(config.skewTo)
      tile.rotation = (pick(config.rotationIn) * Math.PI) / 180
      active.push(tile)
    }
  }
  function frame() {
    if (disposed) return
    const now = performance.now()
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0
    lastFrame = now
    if (document.hidden || !host.isConnected) {
      lastFrame = 0
      previousGeneration = -1
      return
    }
    if (resizePending) resize()
    syncScroll()
    if (!config.animation) return
    const dt = Math.min(elapsed, 0.05)
    if (layer) followScroll(layer, tileScrollTarget, config.tileScrollLag, dt)
    if (clouds) followScroll(clouds.container, cloudScrollTarget, config.cloudScrollLag, dt)
    if (elapsed > 0.2) {
      input?.reset()
      previousGeneration = -1
      budget = 0
    }
    budget = Math.min(24, budget + dt * 180)
    const sample = input?.update(now, dt, width, height)
    if (sample) {
      if (sample.generation !== previousGeneration) {
        spacingRemainder = 0
        previousX = sample.x
        previousY = sample.y
      }
      previousGeneration = sample.generation
      const dx = sample.x - previousX
      const dy = sample.y - previousY
      const distance = Math.hypot(dx, dy)
      const spacing = 8
      const count = Math.floor((distance + spacingRemainder) / spacing)
      const permitted = Math.min(count, Math.floor(budget), 24)
      for (let i = 0; i < permitted; i++) {
        // Spread capped work over the segment and discard excess; never replay it.
        const step = count <= permitted ? (spacing - spacingRemainder + i * spacing) / distance : (i + 1) / permitted
        spawn(previousX + dx * step, previousY + dy * step, sample.vx, sample.vy)
      }
      budget -= permitted
      spacingRemainder = (distance + spacingRemainder) % spacing
      previousX = sample.x
      previousY = sample.y
    } else previousGeneration = -1
    if (pageBound && config.autoplay) {
      ambientIn -= dt
      if (ambientIn <= 0 && input && clouds) {
        ambientIn = random(0.6, 4.5)
        const cx = random(0, width),
          cy = random(0, height)
        for (let i = 0, count = Math.floor(random(1, 8)); i < count; i++) {
          const x = cx + random(-12, 12),
            y = cy + random(-12, 12)
          const zone = input.zoneAt(x, y)
          if (zone >= 0)
            clouds.spawn(x - clouds.container.x, y - clouds.container.y, 0, 0, random(0.2, 0.4), zone > 0, true)
        }
      }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i]
      p.age += dt
      if (p.age >= p.life) {
        release(i)
        continue
      }
      const entrance = easeOut(clamp01(p.age / p.entrance))
      const drift = easeOut(clamp01((p.age - p.delay) / p.exit))
      const fadeAt = p.exit * 0.5
      const envelope = p.age < fadeAt ? entrance : p.fadeFrom * (1 - easeOut(clamp01((p.age - fadeAt) / p.exit)))
      p.sprite.position.set(p.x + p.offsetX * entrance + p.dx * drift, p.y + p.offsetY * entrance + p.dy * drift)
      p.sprite.scale.set(p.scale * envelope)
      p.sprite.alpha = p.alpha * envelope
      p.sprite.skew.set(p.skewFrom + (p.skewTo - p.skewFrom) * entrance)
      p.sprite.rotation = p.rotation * entrance
    }
    clouds?.update(dt)
    app.render()
  }
  try {
    await app.init({
      preference: 'webgl',
      backgroundAlpha: 0,
      antialias: false,
      autoStart: false,
      sharedTicker: false,
      width: host.clientWidth,
      height: host.clientHeight,
      resolution: Math.min(devicePixelRatio || 1, config.resolutionCap),
      autoDensity: true,
    })
    signal.throwIfAborted()
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const sheet = await Assets.load<Spritesheet>({ src: url, data: { cachePrefix: `${url}#` } })
        loaded.push(url)
        return sheet
      }),
    )
    for (const result of results) {
      if (result.status === 'fulfilled') textures.push(...Object.values(result.value.textures))
    }
    signal.throwIfAborted()
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    app.stage.eventMode = 'none'
    clouds = createClouds(app.renderer)
    clouds.resize(config.bufferCount)
    layer = new Container({ eventMode: 'none' })
    app.stage.addChild(clouds.container, layer)
    input = createInput(config)
    host.append(app.canvas)
    resize()
    window.addEventListener(
      'resize',
      () => {
        resizePending = true
      },
      { signal: listeners.signal },
    )
    document.addEventListener(
      'visibilitychange',
      () => {
        lastFrame = 0
        previousGeneration = -1
        spacingRemainder = 0
        budget = 0
      },
      { signal: listeners.signal },
    )
    gsap.ticker.add(frame)
  } catch (error) {
    dispose()
    throw error
  }

  return {
    config,
    update(next: StageConfig) {
      if (disposed) return
      const normalized = normalizeConfig(next)
      if (
        normalized.animation !== config.animation ||
        normalized.autoplay !== config.autoplay ||
        normalized.orbitSize !== config.orbitSize
      )
        input?.reset()
      if (normalized.resolutionCap !== config.resolutionCap) resizePending = true
      Object.assign(config, normalized)
      while (active.length > config.bufferCount) release(active.length - 1, true)
      while (allocated > config.bufferCount) {
        const tile = free.pop()
        if (!tile) break
        tile.sprite.destroy()
        allocated--
      }
      clouds?.resize(config.bufferCount)
      app.stage.visible = config.animation
      if (!config.animation) app.render()
    },
    bindPage() {
      if (disposed) return
      syncScroll()
      scroller = document.scrollingElement
      // Rebase the scroll source across routes without jumping surviving particles.
      scrollLeft = scroller?.scrollLeft ?? 0
      scrollTop = scroller?.scrollTop ?? 0
      input?.bindPage()
      pageBound = true
      resizePending = true
    },
    unbindPage() {
      if (disposed) return
      syncScroll()
      scroller = null
      input?.unbindPage()
      pageBound = false
    },
    dispose,
  }
}
