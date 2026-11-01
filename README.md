# Public astro rebuild of https://unterberg.dev

Dream of my sleepless nights; creating cursor/components interactions with gsap and PixiJS. Will be ported to a modern Astro backbone.

<img src="https://github.com/unterberg-dev/unterberg.dev/blob/master/public/preview.gif?raw=true" alt="drawing" width="480">

## Motivation

I had this cool effect in mind, saw on a flash website years ago. It was a spawn effect, where the user could emit a massive amount of sprites by hovering on a stage. The sprites were spawned at the mouse position and animated to a random position on the screen. So Impressive - always wanted to recreate this effect. Also the [particle-emitter](https://github.com/pixijs/particle-emitter) was a inspiring reference.

## Will change all the time

## Pixi paths, autoplay, and comets

`pages/index.astro` defines a typed `PageScene` and passes it to
`layouts/PixiStage.astro`. The persistent client reads that page's configuration
on each Astro binding. Pointer effects, the idle autoplay ellipse, and autonomous
comets have independent motion sources and share the particle styling controls.
Comets keep flying and spawning while the pointer moves and when autoplay is off.

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
Durations are seconds; playback also accepts `{ speed: 200 }` in CSS pixels per
second, measured along the final scaled curve. The player itself exposes `setPaths`, `resize`,
`playPath`, `update(dtSeconds)`, and `cancel` for reuse. Feed `update` from the
owning stage ticker. Missing, unsupported, malformed, or zero-length paths
fail safely. SVG move commands reset continuity; no bridge is emitted between
subpaths. Resize cancels an affected flight and invalidates measurements.

Comet curvature is authored alongside the paths:

```ts
comet: {
  curvature: [0.06, 0.18], // bow / shorter viewport dimension
},
```

Settings provide two-handle sliders for **Comet spawn rate** (default 10–50/min)
and **Comet speed** (default 600–1500 px/s). Each launch samples its speed and the
next start-to-start interval from those ranges. The first launch follows a fresh
random wait. Changing spawn rate resamples the wait without cancelling the active
flight; speed changes apply to the next flight. Flights never overlap: when a
flight takes longer than its launch interval, the next starts after completion.
Endpoints sit 32 CSS pixels outside distinct edges, away from corners;
adjacent-edge curves bow inward.

The independent Comets checkbox enables or disables comets. Animation pause and
hidden tabs freeze playback and the wait clock; resize, route unbinding, disposal,
and disabling Comets cancel playback. Reduced motion initially disables both
Autoplay and Comets; either can be explicitly enabled independently in settings.
Settings survive Astro route changes for the current page session.

**Cloud spawn rate** controls the random background cloud groups emitted during
Autoplay, using a two-handle range of 1–120 groups/min (default 15–100). Each group
samples its next interval from the selected rates. Adjusting the range resamples
the current wait immediately; Reset restores its defaults. Cloud trails along
pointer, autoplay, and comet motion still use Tail opacity and Tail miss rate.

`input.ts` owns pointer/autoplay selection and named paths; `comets.ts` owns the
independent comet player and launch clock; `scene.ts` owns typed scene options
and random paths. `runtime.ts` keeps separate emission continuity for each source
and shares the existing budget (180 positions/s, 8 px spacing, at most 24 per
frame), reserving comet capacity while the pointer is active. Scroll-plane
conversion stays in the emitter. `zones.ts` separates membership discovery from
bounds invalidation and ignores unrelated settings output/fill/ARIA updates.
Resize, scroll, font, layout, and zone membership changes still update bounds.

Run `pnpm test` for the motion/scheduling regressions, `pnpm verify` for repository
checks, and `pnpm build` for the production build.

Manual browser smoke checklist:

- Leave the home page idle: look for varied, gently bowed crossings from one
  edge to a different edge, with no visible cursor/stroke and no bridges between
  flights. Set spawn rate to 60–60/min and speed to 50–50 px/s to check that a
  longer flight completes before another starts.
- Add the `play` example above to try `curveA`. Try a fast duration and a path
  with two distant `M` subpaths: trails should follow curves, stay bounded, and
  never join the subpaths. Restore the demo configuration after trying it.
- Move the pointer during a comet: both trails should continue independently,
  without bridges between them. Turn Autoplay off: comets should keep spawning.
  Check hitboxes, deadzones, and scrolling. With Autoplay on, idle near each
  corner: the whole ellipse should remain curved alongside the comets.
- Toggle animation/autoplay; hide and restore the tab; resize during a flight.
  Toggle Comets separately and drag both handles on each new slider. Check for
  stale trails, catch-up bursts, or delayed launches after cancellation.
- Navigate home → settings → home repeatedly: retain one canvas and one stage
  ticker callback, with the new page's scene and retained slider values. Check
  reduced motion with Autoplay and Comets initially off, then enable each separately.
- In a performance recording, drag settings sliders: output/fill changes should
  avoid zone queries and bounds reads. Add/remove a zone or alter its class/data
  attributes; move layout, scroll, or resize: bounds should still refresh.
