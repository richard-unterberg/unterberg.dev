import type { StageConfig } from './config'
import { createPathPlayer } from './pathPlayer'
import { cometOptions, cometPath, type PageScene, pick } from './scene'

// A separate player and launch clock let comets run alongside pointer and autoplay emissions.
export const createComets = (config: StageConfig) => {
  const player = createPathPlayer()
  let options = cometOptions({})
  let bound = false
  let width = 0
  let height = 0
  let wait: number | undefined
  const reschedule = () => {
    wait = undefined
  }
  const reset = () => {
    player.cancel()
    reschedule()
  }
  return {
    bindPage(scene: PageScene = {}) {
      reset()
      options = cometOptions(scene)
      bound = true
    },
    unbindPage() {
      bound = false
      reset()
    },
    resize(w: number, h: number) {
      width = w
      height = h
      if (player.resize(w, h)) reschedule()
    },
    reset,
    reschedule,
    update(dt: number) {
      if (!bound || !config.animation || !config.comets || width <= 0 || height <= 0) return null
      if (wait === undefined) wait = 60 / pick(config.cometSpawnRate)
      else wait -= dt
      if (!player.playing && wait <= 0) {
        player.play(cometPath(width, height, options.curvature), { speed: pick(config.cometSpeed) })
        // Start-to-start interval; a long flight completes before the next one launches.
        wait = 60 / pick(config.cometSpawnRate)
        dt = 0
      }
      return player.update(dt)
    },
  }
}
