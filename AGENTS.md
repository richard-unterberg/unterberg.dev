# Agent guide

## Documentation contract

- Read this file before working in this repository. It is the entry point for agent-facing project context, architecture, commands, and validation guidance.
- Keep `README.md` limited to the public project title and introductory text. Put future implementation notes, setup instructions, configuration examples, smoke checklists, and durable agent guidance here.
- Update this file when a change alters the architecture, workflow, configuration contract, or required validation. Keep it accurate and compact; use issues and PRs for task plans and progress logs.
- Check the current source and `package.json` before relying on a documented implementation detail. Distinguish intended behavior from unfinished wiring.

## Project and working approach

This is Richard Unterberg's personal portfolio and public Astro rebuild of unterberg.dev. Its defining visual feature is a PixiJS/GSAP particle and cloud emitter responding to pointer movement, page zones, and idle motion.

The engine was ported from the legacy Vite/React website. Keep the new Astro implementation focused on pointer effects, particles, clouds, zones, and motion paths. The old reveal engine is outside this engine's scope. Favor compact, strongly typed modules over a generic animation framework. Visual fidelity matters, but minor animation differences from the legacy version are acceptable.

Use Astro components and plain TypeScript for the existing site; there is no React runtime in this repository. Keep changes scoped to the requested task. Do not add pages, settings dialogs, dependencies, or test infrastructure merely to demonstrate an engine change. The owner performs the final visual smoke test; report what still needs browser verification.

## Toolchain and commands

- Node 24: see `.nvmrc`. The existing tests use Node's native TypeScript support and `node:module` resolution hooks.
- pnpm: use the version pinned by `packageManager` in `package.json` and preserve `pnpm-lock.yaml`.
- Astro with static output, strict TypeScript, PixiJS 8, and GSAP/MotionPathPlugin.
- Tailwind CSS 4, DaisyUI 5, Tailwind Typography, `@marmo/astro`, and `@lucide/astro`.
- Biome handles formatting/linting; Knip checks unused code.

| Command                          | Purpose                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Install the locked dependencies.                                                            |
| `pnpm dev`                       | Start Astro development.                                                                    |
| `pnpm verify`                    | Run formatting, existing Node tests, Knip, linting, and Astro type checking, in that order. |
| `pnpm test`                      | Run `tests/*.test.ts` with Node's test runner.                                              |
| `pnpm typecheck`                 | Run `astro check`.                                                                          |
| `pnpm check:knip`                | Run Knip.                                                                                   |
| `pnpm format` / `pnpm lint`      | Format/lint with Biome; both commands write changes.                                        |
| `pnpm build`                     | Produce the static site in `dist/`.                                                         |
| `pnpm preview`                   | Preview an existing production build.                                                       |
| `pnpm prod`                      | Build and then preview.                                                                     |

Run `pnpm verify` after implementation changes; also run `pnpm build` when changing page rendering, assets, styles, routing, or build integration. Inspect the diff afterward because verification can rewrite files. Avoid unrelated formatter churn. Documentation-only changes can be validated by checking their content, paths, and commands without rebuilding the application. Do not claim checks or browser smoke tests that were not performed.

The existing regression suite is part of `verify`; retain it. Add focused coverage only when it meaningfully checks changed behavior, without introducing a new testing framework or broad test scaffolding.

## Repository map

Astro uses `srcDir: '.'`: application sources live at the repository root, not under `src/`.

| Location                                      | Responsibility                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/`                                      | Routes: home, work, contact, settings, and 404. Author page content and page-specific scene definitions here.                                  |
| `layouts/AppShell.astro`                      | HTML shell, global CSS, metadata, and header.                                                                                                  |
| `components/MetaHead.astro`                   | Canonical URLs, robots, local fonts, icons, and Astro `ClientRouter`.                                                                          |
| `layouts/PixiStage.astro`                     | Main content layout and inclusion of the persistent stage host.                                                                                |
| `components/`                                 | Shared Astro UI, icons, and Marmo-based layout/headline components.                                                                            |
| `styles/global.css`                           | Tailwind/DaisyUI theme, typography, and global styling.                                                                                        |
| `lib/pixiStage/Stage.astro`                   | Fixed, pointer-transparent, aria-hidden host with `transition:persist="emitter-stage"`; imports the client entry.                              |
| `lib/pixiStage/client.ts`                     | Lazy runtime initialization, Astro navigation lifecycle, page/control binding, reduced-motion overrides, and teardown.                         |
| `lib/pixiStage/runtime.ts`                    | Pixi application/assets, the single GSAP frame callback, pooled sprites, emission budgets, scroll planes, configuration updates, and disposal. |
| `lib/pixiStage/config.ts`                     | `PixiConfig` definitions, `StageConfig`, defaults, units, ranges, and normalization.                                                           |
| `lib/pixiStage/Controls.astro`, `controls.ts` | Settings markup and input/reset binding against the same configuration definitions.                                                            |
| `lib/pixiStage/input.ts`                      | Pointer activity, idle ellipse, named-path selection, and zone ownership.                                                                      |
| `lib/pixiStage/pathPlayer.ts`                 | SVG path validation, viewport-scaled geometry/cache, playback, and motion samples.                                                             |
| `lib/pixiStage/scene.ts`, `comets.ts`         | Typed `PageScene`, random bowed paths, and the idle comet launch clock/player.                                                                 |
| `lib/pixiStage/zones.ts`                      | Zone membership discovery, cached bounds, and invalidation observers.                                                                          |
| `lib/pixiStage/clouds.ts`                     | Once-baked shader texture and pooled cloud particles.                                                                                          |
| `public/`                                     | Static fonts, sun/moon spritesheets, portfolio data, and project images.                                                                       |
| `tests/pixiStage.test.ts`                     | Configuration, path measurement, pointer interruption, and comet scheduling regressions.                                                       |

Import aliases are `@components/*`, `@layouts/*`, `@styles/*`, and `@lib/*` (see `tsconfig.json`). Follow Biome's two-space indentation, single-quoted TypeScript strings, and no unnecessary semicolons.

## Rendering, data, and build constraints

- Preserve static rendering and the existing client navigation via `ClientRouter`. Keep DOM/browser APIs in client modules, out of Astro server execution.
- `astro.config.ts` sets `site: 'https://unterberg.dev/'`, trailing slashes, Marmo, Tailwind's Vite plugin, and Beasties critical CSS output.
- Beasties deliberately preserves keyframes, theme selectors, sizing utilities, and `prose-container` rules for head swaps. Check the production build and navigation when modifying these rules or related styles.
- Use the shared shell/layouts and existing theme tokens. Keep links, text, and controls readable above the decorative canvas; keep the canvas noninteractive.
- `pages/work.astro` fetches project JSON during static rendering from the raw GitHub URL on **main**, corresponding to `public/data/open-source-projects.json`. It does not currently import the branch's local JSON. A branch-only data edit will therefore not appear in the rendered work page until the source URL serves it. Builds require access to that URL; report fetch failures accurately.
- The work page's `Project` type describes the data contract; `group` separates regular and grouped entries. Images are under `public/work/`. Contact and parts of the work page are still being authored; do not invent final portfolio copy or silently expand the task.

## Stage lifecycle and performance

- Keep one persistent canvas and one owning GSAP ticker callback across Astro route changes. Pixi's automatic ticker is disabled; rendering is driven by the runtime's frame callback.
- Before a route swap, unbind page listeners, zones, paths, comets, and controls. After the swap/page load, bind the new DOM without creating another application. Preserve settings in the live runtime across client navigation; this is in-memory state, not reload persistence.
- Abort asynchronous initialization safely and clean up listeners, observers, assets, textures, pools, and ticker callbacks on disposal/HMR. Keep the existing distinction for persisted `pagehide` events.
- Reuse sprites/cloud particles and enforce bounded capacity. The shared emission budget is currently 180 positions/s, 8 CSS px spacing, and at most 24 positions per frame; idle ellipse and comet trails share that budget.
- Keep independent emission continuity per source. Source switches, SVG subpaths, route changes, and cancellation must not create bridges or catch-up bursts.
- Motion samples and zone bounds use viewport CSS pixels. Scroll-plane conversion belongs in the emitter. Preserve separate tile/cloud scroll lag and cloud parallax without replaying earlier scroll deltas.
- Cache zone discovery and bounds. Resize, scroll, font loading, layout, and zone membership changes must invalidate appropriately. Settings output, fill, and ARIA updates should not trigger repeated zone discovery or bounds reads.
- `pixi-hitbox` / `data-pixi-hitbox` mark softer effects; `pixi-deadzone` / `data-pixi-deadzone` suppress emission. Deadzones win overlaps. Keep important controls usable and protected.
- Pausing animation and hiding the tab freeze playback/wait clocks. Discard stale emission continuity on resume. Reduced motion initially disables Autoplay and Comets; explicit user overrides are respected.

## Configuration, paths, and idle effects

Use `config.ts` as the single source for user-adjustable emitter defaults, ranges, labels, and units. The settings page renders those definitions. Keep typed page-specific choreography near its page (currently `pages/index.astro`) rather than adding a new popup or separate configuration UI.

A `PageScene` supports named SVG paths, optional entry playback, and comet curvature:

```ts
const scene = {
  paths: {
    curveA: {
      d: 'M-40,200 C240,40 760,560 1040,400',
      viewBox: [0, 0, 1000, 600],
    },
  },
  // Optional entry playback:
  play: { name: 'curveA', duration: 2, ease: 'none' },
  comet: { curvature: [0.06, 0.18] },
} satisfies PageScene
```

**Current integration gap:** `pages/index.astro` passes `scene` to `layouts/PixiStage.astro`, but that layout currently neither reads nor serializes the prop. `client.ts` looks for an element inside `main` carrying JSON in `data-pixi-scene`; none is emitted by the current layout. Page-authored paths, entry playback, and curvature overrides consequently do not reach the runtime; it binds an empty scene and uses defaults. Do not assume the example is connected end to end. Recheck this wiring when working on page scenes and update this note after a fix.

Path/runtime contracts:

- `PathDefinition` uses SVG `d` plus `[left, top, width, height]` viewBox. Each axis stretches independently to the viewport. GSAP MotionPathPlugin parses geometry; measurements are cached **after scaling**, so speed follows the final curve even in wide/tall viewports.
- Playback accepts either `{ duration: 2 }` (seconds) or `{ speed: 200 }` (CSS px/s). Linear playback is the default; path easing is separate from particle easing.
- The runtime exposes `stage.playPath(name, options)` with a boolean result. The reusable player exposes `setPaths`, `resize`, `playPath`, `play` for generated paths, `update(dtSeconds)`, and `cancel`; feed it from the owning ticker.
- Missing, unsupported, malformed, or zero-length paths fail safely. SVG move commands reset continuity between subpaths. Changed viewport dimensions invalidate measurements and cancel affected playback.
- Comets describe motion that emits the existing effects, not a visible comet sprite, line, or synthetic DOM cursor. Endpoints lie 32 CSS px outside distinct edges and away from corners; adjacent-edge curves bow inward.
- Comets launch only during idle Autoplay, after the idle delay and a fresh sampled wait. Pointer activity cancels the flight and discards its clock immediately. Returning to idle starts a fresh wait; disabling Autoplay or Comets, unbinding, disposal, and resize cancel playback.
- Settings currently use comet spawn rate 10–50/min and speed 600–1500 px/s as defaults. Each launch samples speed and a start-to-start interval. Flights never overlap; a flight longer than its interval completes first. Changing spawn rate resamples the wait without cancelling the flight; speed changes affect the next launch.
- Background cloud groups use Cloud spawn rate (default 15–100 groups/min, allowed 1–120). Changing the range resamples the wait; Reset restores defaults. Motion trails separately use Tail opacity and Tail miss rate.

## Browser smoke checks for relevant changes

The Node tests do not verify WebGL rendering, DOM scene wiring, or route persistence. For engine/UI changes, report which of these were checked and leave final visual acceptance to the owner:

- Move the pointer across hitboxes/deadzones and scroll the page. Verify soft/suppressed effects, readable content, working links, and stable scroll-plane behavior.
- Idle with Autoplay and Comets enabled: expect varied bowed edge-to-different-edge flights alongside the ellipse, with no visible cursor/stroke or trail bridges. Use 60–60/min and 50–50 px/s to check that long flights do not overlap.
- Interrupt a comet with pointer movement. New comet emissions stop immediately while existing particles fade; continued movement prevents launches. After movement stops, the idle delay and a fresh wait precede another launch. Autoplay off keeps comets off.
- When scene wiring is connected, try the named path/entry-play example, fast durations, distant `M` subpaths, and wide/tall viewports. Check curve-following trails, bounded work, and no subpath bridges. Restore temporary demo settings afterward.
- Toggle Animation, Autoplay, and Comets; hide/restore the tab; resize during a flight; drag both slider handles and Reset. Check for stale trails, catch-up bursts, or delayed launches after cancellation.
- Navigate home → settings → work → home repeatedly. Retain one canvas/ticker callback, retained settings, and freshly bound page controls/zones/scenes. Check reduced-motion defaults and explicit opt-in.
- Profile slider interaction: output/fill/ARIA updates should avoid zone discovery/bounds work. Add/remove zones or change their class/data attributes, layout, scroll position, or viewport size; bounds must still refresh.
