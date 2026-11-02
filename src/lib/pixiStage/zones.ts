type Zone = { bounds: DOMRect; dead: boolean }
const selector = '.pixi-hitbox, .pixi-deadzone, [data-pixi-hitbox], [data-pixi-deadzone]'
const hasZone = (node: Node) => node instanceof Element && (node.matches(selector) || !!node.querySelector(selector))

export const createZones = () => {
  let page: AbortController | undefined
  let observer: ResizeObserver | undefined
  let mutation: MutationObserver | undefined
  let main: Element | null = null
  let elements: Element[] = []
  let zones: Zone[] = []
  let dirty = true
  let discover = true
  const markDirty = () => {
    dirty = true
  }
  const unbind = () => {
    page?.abort()
    observer?.disconnect()
    mutation?.disconnect()
    page = undefined
    main = null
    elements = []
    zones = []
  }
  return {
    markDirty,
    unbind,
    bind() {
      unbind()
      page = new AbortController()
      main = document.querySelector('main')
      observer = new ResizeObserver(markDirty)
      mutation = new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement
          if (!target) continue
          const attr = record.attributeName
          let membership = false
          if (record.type === 'childList') {
            membership = [...record.addedNodes, ...record.removedNodes].some(hasZone)
          } else if (attr === 'data-pixi-hitbox' || attr === 'data-pixi-deadzone') membership = true
          else if (attr === 'class') {
            const before = (record.oldValue ?? '').split(/\s+/)
            membership = ['pixi-hitbox', 'pixi-deadzone'].some(
              (name) => before.includes(name) !== target.classList.contains(name),
            )
          }
          if (membership) discover = dirty = true
          // These updates cannot change membership. ResizeObserver still catches settings layout changes.
          const decoration =
            target.closest('[data-pixi-controls]') &&
            (target.closest('[data-pixi-value]') ||
              (target.matches('[data-pixi-fill]') && (attr === 'x' || attr === 'width')) ||
              attr === 'aria-valuemin' ||
              attr === 'aria-valuemax')
          if (!decoration) dirty = true
        }
      })
      if (main)
        mutation.observe(main, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeOldValue: true,
          characterData: true,
        })
      // Ancestor class/style changes can alter layout without changing zone membership.
      mutation.observe(document.body, { attributes: true })
      mutation.observe(document.documentElement, { attributes: true })
      document.addEventListener('scroll', markDirty, { capture: true, passive: true, signal: page.signal })
      document.addEventListener('load', markDirty, { capture: true, signal: page.signal })
      document.fonts.addEventListener('loadingdone', markDirty, { signal: page.signal })
      const binding = page
      void document.fonts.ready.then(() => {
        if (!binding.signal.aborted) markDirty()
      })
      discover = dirty = true
    },
    update() {
      if (!page || !dirty) return
      if (discover) {
        observer?.disconnect()
        observer?.observe(document.body)
        if (main) observer?.observe(main)
        elements = [...document.querySelectorAll(selector)]
        for (const element of elements) observer?.observe(element)
        discover = false
      }
      zones = elements.map((element) => ({
        bounds: element.getBoundingClientRect(),
        dead: element.matches('.pixi-deadzone, [data-pixi-deadzone]'),
      }))
      dirty = false
    },
    at(x: number, y: number) {
      let soft = 0
      for (const { bounds: b, dead } of zones) {
        if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
          if (dead) return -1
          soft = 1
        }
      }
      return soft
    },
  }
}
