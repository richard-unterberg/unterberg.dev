type Range = [number, number]

const single = (label: string, value: number, min: number, max: number, step: number, unit = '') => ({
  label,
  value,
  min,
  max,
  step,
  unit,
})
const range = (label: string, value: Range, min: number, max: number, step: number, unit = '') => ({
  label,
  value,
  min,
  max,
  step,
  unit,
})

// Legacy PixiConfig snapshot, in the units used by the runtime and controls.
export const PixiConfig = {
  scaleModifier: single('Base scale', 1, 0.3, 2, 0.01),
  cursorRadius: single('Pointer radius', 1, 0, 1.5, 0.01),
  pointerInertia: single('Inertia', 1.2, 1, 3, 0.01),
  gravity: single('Gravity', 0, -3, 3, 0.01),
  pointerMissRate: single('Pointer miss rate', 0.4, 0, 1, 0.01),
  inDuration: range('Entrance duration', [0.14, 0.4], 0.1, 0.9, 0.01, 's'),
  outDuration: range('Exit duration', [0.9, 1.5], 0.6, 2, 0.01, 's'),
  outDelay: range('Exit delay', [0.04, 0.15], 0.04, 0.15, 0.01, 's'),
  scaleIn: range('Entrance scale', [0.5, 1.9], 0.1, 1.9, 0.01),
  scaleHitboxIn: range('Hitbox scale', [0.1, 0.3], 0.1, 0.3, 0.01),
  alphaIn: range('Entrance opacity', [0.1, 1], 0, 1, 0.01),
  skewFrom: range('Starting skew', [-1.1, 1.1], -2, 2, 0.01, 'rad'),
  skewTo: range('Ending skew', [-0.2, 0.2], -2, 2, 0.01, 'rad'),
  rotationIn: range('Rotation', [-160, 160], -360, 360, 1, '°'),
  pixelSpread: range('Outward spread', [0, 10], 0, 150, 1, 'px'),
  tailOpacity: single('Tail opacity', 0.1, 0, 0.3, 0.01),
  tailMissRate: single('Tail miss rate', 0.9, 0.7, 1, 0.01),
  tileScrollLag: single('Tile scroll lag', 10, 0, 400, 10, 'ms'),
  cloudScrollLag: single('Cloud scroll lag', 20, 0, 400, 10, 'ms'),
  cloudParallaxOffset: single('Cloud parallax offset', 50, 0, 100, 1, '%'),
  cloudSpawnRate: range('Cloud spawn rate', [15, 100], 1, 120, 1, 'groups/min'),
  bufferCount: single('Particle capacity', 800, 10, 4000, 10),
  idleDelay: single('Autoplay idle delay', 200, 0, 10000, 50, 'ms'),
  autoplaySpeed: single('Autoplay speed', 0.7, 0.1, 3, 0.01, 'rad/s'),
  orbitSize: single('Autoplay orbit size', 80, 0, 300, 1, 'px'),
  cometSpawnRate: range('Comet spawn rate', [10, 50], 1, 60, 1, '/min'),
  cometSpeed: range('Comet speed', [600, 1500], 50, 2000, 10, 'px/s'),
  resolutionCap: single('Render resolution cap', 1.5, 0.5, 2, 0.1),
}

export type StageConfig = {
  [K in keyof typeof PixiConfig]: (typeof PixiConfig)[K]['value']
} & { animation: boolean; autoplay: boolean; comets: boolean }

export const createConfig = (reducedMotion = false): StageConfig => {
  return {
    ...Object.fromEntries(
      Object.entries(PixiConfig).map(([key, { value }]) => [key, Array.isArray(value) ? [...value] : value]),
    ),
    animation: true,
    autoplay: !reducedMotion,
    comets: !reducedMotion,
  } as StageConfig
}

export const normalizeConfig = (next: StageConfig): StageConfig => {
  const config = createConfig()
  for (const key of Object.keys(PixiConfig) as (keyof typeof PixiConfig)[]) {
    const definition = PixiConfig[key]
    const clamp = (value: number, fallback: number) =>
      Number.isFinite(value) ? Math.min(definition.max, Math.max(definition.min, value)) : fallback
    const value = next[key]
    if (Array.isArray(definition.value)) {
      const values = Array.isArray(value) ? value : definition.value
      const low = clamp(values[0], definition.value[0])
      const high = clamp(values[1], definition.value[1])
      Object.assign(config, { [key]: [Math.min(low, high), Math.max(low, high)] })
    } else {
      Object.assign(config, { [key]: clamp(typeof value === 'number' ? value : Number.NaN, definition.value) })
    }
  }
  config.bufferCount = Math.floor(config.bufferCount)
  config.animation = typeof next.animation === 'boolean' ? next.animation : true
  config.autoplay = typeof next.autoplay === 'boolean' ? next.autoplay : true
  config.comets = typeof next.comets === 'boolean' ? next.comets : true
  return config
}
