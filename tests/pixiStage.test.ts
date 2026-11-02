import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Run the bundler's extensionless TypeScript/GSAP imports directly with Node 24.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') throw error
      if (specifier.startsWith('.')) return nextResolve(`${specifier}.ts`, context)
      if (specifier.startsWith('gsap/')) return nextResolve(`${specifier}.js`, context)
      throw error
    }
  },
})

const { createConfig, normalizeConfig } = await import('../src/lib/pixiStage/config.ts')
const { createComets } = await import('../src/lib/pixiStage/comets.ts')
const { createInput } = await import('../src/lib/pixiStage/input.ts')
const { createPathPlayer } = await import('../src/lib/pixiStage/pathPlayer.ts')

const setup = () => {
  const config = createConfig()
  config.autoplay = true
  config.cometSpawnRate = [60, 60]
  config.cometSpeed = [100, 100]
  const comets = createComets(config)
  comets.resize(1000, 600)
  comets.bindPage()
  return { config, comets }
}
const launch = (comets: ReturnType<typeof createComets>) => {
  assert.equal(comets.update(0, true), null)
  const sample = comets.update(1, true)
  assert.ok(sample)
  assert.equal(sample.travel?.distance, 0)
  return sample
}
const close = (actual: number | undefined, expected: number) => {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 0.001, `${actual} should be ${expected}`)
}

test('comet settings normalize ranges and respect reduced motion defaults', () => {
  const defaults = createConfig()
  const config = createConfig(true)
  assert.equal(config.autoplay, false)
  assert.equal(config.comets, false)
  config.comets = true
  config.cometSpawnRate = [100, -10]
  config.cometSpeed = [Number.NaN, 5000]
  const normalized = normalizeConfig(config)
  assert.equal(normalized.autoplay, false)
  assert.equal(normalized.comets, true)
  assert.deepEqual(normalized.cometSpawnRate, [1, 60])
  assert.deepEqual(normalized.cometSpeed, [defaults.cometSpeed[0], 2000])
})

test('path speed uses distance after viewport scaling and rejects invalid speeds', () => {
  const player = createPathPlayer()
  player.resize(1000, 600)
  const path = { d: 'M0,0 L100,0', viewBox: [0, 0, 100, 100] as [number, number, number, number] }
  assert.equal(player.play(path, { speed: 200 }), true)
  close(player.update(1)?.x, 200)
  close(player.update(4)?.x, 1000)
  assert.equal(player.playing, false)
  assert.equal(player.play(path, { duration: 2 }), true)
  close(player.update(1)?.x, 500)
  for (const speed of [0, -1, Number.NaN, Infinity]) assert.equal(player.play(path, { speed }), false)
})

test('pointer activity immediately cancels comets and idle restarts with a fresh spawn wait', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), {
    querySelector: () => null,
    querySelectorAll: () => [],
    fonts: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
    body: {},
    documentElement: {},
  })
  class Observer {
    observe() {}
    disconnect() {}
  }
  const globals = {
    window,
    document,
    matchMedia: () => ({ matches: true }),
    ResizeObserver: Observer,
    MutationObserver: Observer,
  }
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
  const { config, comets } = setup()
  const input = createInput(config, comets.reset)
  t.after(() => input.dispose())
  input.resize(1000, 600)
  input.bindPage()
  const initial = launch(comets)
  close(comets.update(0.1, true)?.travel?.distance, 10)
  for (let i = 0; i < 10; i++) {
    now += 30
    window.dispatchEvent(
      Object.assign(new Event('pointermove'), { pointerType: 'mouse', clientX: 10 + i * 10, clientY: 20 }),
    )
    // Even before the frame checks idleness, the event must have discarded the old flight.
    assert.equal(comets.update(0, true), null)
    const idle = input.isIdle(now)
    assert.equal(idle, false)
    const pointer = input.update(now, 0.03, 1000, 600)
    assert.ok(pointer)
    assert.equal(pointer.x, 10 + i * 10)
    assert.equal(comets.update(0.03, idle), null)
  }
  now += config.idleDelay - 1
  assert.equal(input.isIdle(now), false)
  assert.equal(comets.update(0.1, input.isIdle(now)), null)
  now++
  assert.equal(input.isIdle(now), true)
  assert.equal(comets.update(0, input.isIdle(now)), null)
  assert.equal(comets.update(0.9, input.isIdle(now)), null)
  const resumed = comets.update(0.2, input.isIdle(now))
  assert.ok(resumed)
  assert.notEqual(resumed.generation, initial.generation)
  assert.equal(resumed.travel?.distance, 0)

  // Touch movements are not a cursor; leaving the viewport cancels the current flight.
  window.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'touch', clientX: 10, clientY: 20 }))
  assert.equal(comets.update(0.1, true)?.generation, resumed.generation)
  document.dispatchEvent(Object.assign(new Event('pointerout'), { relatedTarget: null }))
  assert.equal(input.isIdle(now), true)
  assert.equal(comets.update(0, true), null)

  // With no idle delay, a pending pointer event still owns its first frame.
  config.idleDelay = 0
  window.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'pen', clientX: 30, clientY: 40 }))
  assert.equal(input.isIdle(now), false)
  input.update(now, 0, 1000, 600)
  assert.equal(input.isIdle(now), true)
})

test('autoplay off cancels playback and enabling it starts a fresh wait', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { config, comets } = setup()
  const initial = launch(comets)
  close(comets.update(0.1, true)?.travel?.distance, 10)
  config.autoplay = false
  assert.equal(comets.update(100, true), null)
  config.autoplay = true
  assert.equal(comets.update(0, true), null)
  assert.equal(comets.update(0.9, true), null)
  const resumed = comets.update(0.2, true)
  assert.ok(resumed)
  assert.notEqual(resumed.generation, initial.generation)
  assert.equal(resumed.travel?.distance, 0)
})

test('activity discards an almost complete spawn wait without a catch-up launch', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { comets } = setup()
  assert.equal(comets.update(0, true), null)
  assert.equal(comets.update(0.9, true), null)
  assert.equal(comets.update(100, false), null)
  assert.equal(comets.update(0, true), null)
  assert.equal(comets.update(0.9, true), null)
  const first = comets.update(0.2, true)
  assert.ok(first)
  assert.equal(first.travel?.distance, 0)
})

test('spawn rate determines the initial wait and long flights finish before the next launch', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { config, comets } = setup()
  config.cometSpawnRate = [12, 12]
  assert.equal(comets.update(0, true), null)
  assert.equal(comets.update(4.9, true), null)
  const initial = comets.update(0.2, true)
  assert.ok(initial)
  const continuing = comets.update(5, true)
  assert.equal(continuing?.generation, initial.generation)
  const end = comets.update(100, true)
  assert.equal(end?.generation, initial.generation)
  const next = comets.update(0, true)
  assert.ok(next)
  assert.notEqual(next.generation, initial.generation)
  assert.equal(next.travel?.distance, 0)
})

test('speed is sampled per flight and rescheduling does not cancel an active comet', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { config, comets } = setup()
  const initial = launch(comets)
  close(comets.update(0.25, true)?.travel?.distance, 25)
  config.cometSpeed = [500, 500]
  comets.reschedule()
  const continuing = comets.update(0.25, true)
  assert.equal(continuing?.generation, initial.generation)
  close(continuing?.travel?.distance, 25)
  comets.update(100, true)
  assert.ok(comets.update(0, true))
  close(comets.update(0.25, true)?.travel?.distance, 125)
})

test('animation pause freezes both the spawn clock and the current flight', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { config, comets } = setup()
  assert.equal(comets.update(0, true), null)
  assert.equal(comets.update(0.5, true), null)
  config.animation = false
  assert.equal(comets.update(100, true), null)
  config.animation = true
  assert.equal(comets.update(0.4, true), null)
  const initial = comets.update(0.2, true)
  assert.ok(initial)
  config.animation = false
  assert.equal(comets.update(100, true), null)
  config.animation = true
  const continued = comets.update(0.1, true)
  assert.equal(continued?.generation, initial.generation)
  close(continued?.travel?.distance, 10)
})

test('resize, page unbinding, and disabling comets discard playback without a catch-up launch', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const { config, comets } = setup()
  const initial = launch(comets)
  comets.resize(800, 600)
  const resized = launch(comets)
  assert.notEqual(resized.generation, initial.generation)
  comets.unbindPage()
  assert.equal(comets.update(100, true), null)
  comets.bindPage()
  const rebound = launch(comets)
  assert.notEqual(rebound.generation, resized.generation)
  config.comets = false
  comets.reset()
  assert.equal(comets.update(100, true), null)
  config.comets = true
  const restarted = launch(comets)
  assert.notEqual(restarted.generation, rebound.generation)
})
