# Public astro rebuild of https://unterberg.dev

Dream of my sleepless nights; creating cursor/components interactions with gsap and PixiJS. Will be ported to a modern Astro backbone.

<img src="https://github.com/unterberg-dev/unterberg.dev/blob/master/public/preview.gif?raw=true" alt="drawing" width="480">

## Motivation

I had this cool effect in mind, saw on a flash website years ago. It was a spawn effect, where the user could emit a massive amount of sprites by hovering on a stage. The sprites were spawned at the mouse position and animated to a random position on the screen. So Impressive - always wanted to recreate this effect. Also the [particle-emitter](https://github.com/pixijs/particle-emitter) was a inspiring reference.

## Will change all the time

## Pixi paths and autoplay

`pages/index.astro` defines a typed `PageScene` and passes it to
`layouts/PixiStage.astro`. The persistent client reads that page's configuration
on each Astro binding. The home page selects comet mode; settings can select
ellipse or comet without changing the particle styling controls.

Named paths use SVG `d` strings and a `[left, top, width, height]` viewBox. Each
axis stretches to the viewport in CSS pixels. `lib/pixiStage/pathPlayer.ts`
uses GSAP MotionPathPlugin to parse and cache measurements **after** scaling, so
traversal follows distance on the final curve, even in wide or tall viewports.
The default ease is linear; playback easing is separate from particle easing.

For an authored flight on page entry, add this to the scene in `pages/index.astro`:

```ts
play: { name: 'curveA', duration: 2, ease: 'none' },
```

The runtime returned by `createStage` also exposes
`stage.playPath('curveA', { duration: 2 })`, returning whether playback started.
Durations are seconds. The player itself exposes `setPaths`, `resize`,
`playPath`, `update(dtSeconds)`, and `cancel` for reuse. Feed `update` from the
owning stage ticker. Missing, unsupported, malformed, or zero-length paths
fail safely. SVG move commands reset continuity; no bridge is emitted between
subpaths. Resize cancels an affected flight and invalidates measurements.

Comet options are authored alongside the paths:

```ts
comet: {
  interval: [2, 20],    // seconds between starts, sampled at launch
  duration: [2, 5],    // independent seconds per flight
  curvature: [0.06, 0.18], // bow / shorter viewport dimension
},
```

The first launch follows a fresh random wait. Each launch samples its next
start-to-start interval. Flights never overlap: when duration exceeds that
interval, the next flight starts after completion. Endpoints sit 32 CSS pixels
outside distinct edges, away from corners; adjacent-edge curves bow inward.
Pointer movement cancels a flight. After the normal idle delay, comet mode
samples a fresh wait. Animation pause and hidden tabs freeze playback and the
wait clock; autoplay off, resize, route unbinding, and disposal cancel playback.
Autoplay remains off under reduced motion until explicitly enabled in settings.

`input.ts` owns source selection and scheduling; `scene.ts` owns typed scene
options and random paths; `runtime.ts` samples the curve through the existing
emitter (180 positions/s, 8 px spacing, at most 24 per frame). Scroll-plane
conversion stays in the emitter. `zones.ts` separates membership discovery from
bounds invalidation and ignores unrelated settings output/fill/ARIA updates.
Resize, scroll, font, layout, and zone membership changes still update bounds.

Manual browser smoke checklist (visual acceptance awaits the user's result):

- Leave the home page idle: look for varied, gently bowed crossings from one
  edge to a different edge, with no visible cursor/stroke and no bridges between
  flights. Temporarily set `interval: [0.2, 0.2]`, `duration: [2, 2]` to check
  that a longer flight completes before another starts.
- Add the `play` example above to try `curveA`. Try a fast duration and a path
  with two distant `M` subpaths: trails should follow curves, stay bounded, and
  never join the subpaths. Restore the demo configuration after trying it.
- Move the pointer during a comet: pointer effects should take over immediately,
  then a fresh wait should follow idle. Check hitboxes, deadzones, and scrolling.
  Select ellipse and idle near each corner: the whole orbit should remain curved.
- Toggle animation/autoplay; hide and restore the tab; resize during a flight.
  Check for stale trails, catch-up bursts, or delayed launches after cancellation.
- Navigate home → settings → home repeatedly: retain one canvas and one stage
  ticker callback, with the new page's scene. Check reduced motion with autoplay
  initially off, then explicitly enable it through the existing checkbox.
- In a performance recording, drag settings sliders: output/fill changes should
  avoid zone queries and bounds reads. Add/remove a zone or alter its class/data
  attributes; move layout, scroll, or resize: bounds should still refresh.
