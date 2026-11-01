import { createConfig, normalizeConfig, PixiConfig, type StageConfig } from './config'

export const bindControls = (config: StageConfig, update: (next: StageConfig) => void): (() => void) => {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-pixi-controls]')]
  const listeners = new AbortController()
  const render = () => {
    for (const root of roots) {
      for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-pixi-key]')) {
        const key = input.dataset.pixiKey as keyof StageConfig
        const value = config[key]
        if (typeof value === 'boolean' && input instanceof HTMLInputElement) input.checked = value
        else input.value = String(Array.isArray(value) ? value[Number(input.dataset.pixiBound)] : value)
      }
      for (const slider of root.querySelectorAll<HTMLElement>('[data-pixi-slider]')) {
        const [low, high] = slider.querySelectorAll<HTMLInputElement>('.thumb')
        const fill = slider.querySelector<SVGRectElement>('[data-pixi-fill]')
        if (!low || !fill) continue
        const percent = (value: number) => ((value - Number(low.min)) / (Number(low.max) - Number(low.min))) * 100
        const left = high ? percent(low.valueAsNumber) : 0
        const right = percent((high ?? low).valueAsNumber)
        fill.setAttribute('x', `${left}%`)
        fill.setAttribute('width', `${right - left}%`)
        if (high) {
          low.setAttribute('aria-valuemax', high.value)
          high.setAttribute('aria-valuemin', low.value)
        }
      }
      for (const output of root.querySelectorAll<HTMLOutputElement>('[data-pixi-value]')) {
        const key = output.dataset.pixiValue as keyof typeof PixiConfig
        const value = config[key]
        const formatted = Array.isArray(value) ? value.map(format).join(' – ') : format(value)
        output.value = `${formatted}${PixiConfig[key].unit ? ` ${PixiConfig[key].unit}` : ''}`
      }
    }
  }
  const apply = (next: StageConfig) => {
    const normalized = normalizeConfig(next)
    update(normalized)
    Object.assign(config, normalized)
    render()
  }
  for (const root of roots) {
    root.addEventListener(
      'input',
      (event) => {
        const input = event.target
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement) || !input.dataset.pixiKey) return
        const key = input.dataset.pixiKey as keyof StageConfig
        const next = { ...config }
        const current = config[key]
        if (input instanceof HTMLSelectElement) Object.assign(next, { [key]: input.value })
        else if (typeof current === 'boolean') Object.assign(next, { [key]: input.checked })
        else if (Array.isArray(current)) {
          const values: [number, number] = [...current]
          const bound = Number(input.dataset.pixiBound)
          values[bound] =
            bound === 0 ? Math.min(input.valueAsNumber, current[1]) : Math.max(input.valueAsNumber, current[0])
          Object.assign(next, { [key]: values })
        } else Object.assign(next, { [key]: input.valueAsNumber })
        apply(next)
      },
      { signal: listeners.signal },
    )
    root.addEventListener(
      'click',
      (event) => {
        const target = event.target
        if (!(target instanceof Element) || target instanceof HTMLInputElement) return
        const slider = target.closest<HTMLElement>('[data-pixi-slider]')
        if (!slider || !root.contains(slider)) return
        const [low, high] = slider.querySelectorAll<HTMLInputElement>('.thumb')
        const rect = slider.getBoundingClientRect()
        if (!low || !rect.width) return
        const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const value = Number(low.min) + fraction * (Number(low.max) - Number(low.min))
        const input =
          high &&
          value > low.valueAsNumber &&
          Math.abs(value - high.valueAsNumber) <= Math.abs(value - low.valueAsNumber)
            ? high
            : low
        input.focus()
        input.value = String(value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      },
      { signal: listeners.signal },
    )
    root.querySelector('[data-pixi-reset]')?.addEventListener(
      'click',
      () => {
        apply({
          ...createConfig(matchMedia('(prefers-reduced-motion: reduce)').matches),
          autoplayMode: config.autoplayMode,
        })
      },
      { signal: listeners.signal },
    )
  }
  render()
  return () => listeners.abort()
}

const format = (value: number) => String(Number(value.toFixed(2)))
