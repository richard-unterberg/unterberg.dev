# Phase 1: Port the legacy emitter into Astro

## Objective

Implement a compact, standalone PixiJS emitter/shader engine in `unterberg.dev`. Recreate the complete visual feature set of the **pointer/emitter subsystem**: sprite bursts, animated motion and disappearance, cloud/shader tail, ambient clouds, idle autoplay, and hitbox/deadzone interaction. Small visual differences are acceptable; preserve the character of the effect and meaningful live parameter controls.

This is **not a port of any reveal engine**. Do not implement content reveals, scroll reveals, text/header staggers, reveal masks, or hide/show page content through the canvas.

Complete all steps below, then run only `pnpm verify` and hand over for the user's manual smoke test.

## Workspace and sources

- Target: https://github.com/richard-unterberg/unterberg.dev — `main`.
- Read-only legacy source: https://github.com/richard-unterberg/unterberg.dev-old — `master`.
- Reference commits reviewed for this plan: target `6ee8e1183065ed4476ffd1b66f2ddcc472230e5e`; legacy `d2572fbdd6f77733ec8e9d858f6e4c98d9688ca8`. These identify the reviewed baseline; inspect current local changes rather than resetting either checkout.
- Both repositories may be available in the VS Code workspace. Locate them and read applicable `AGENTS.md` instructions. Copy required assets and useful shader code between checkouts; leave the legacy repository unchanged.
- Follow the target's existing root-level layout (`pages/`, `layouts/`, `components/`), aliases, styling, and package manager.

Read these legacy files first; follow their imports only as needed:

| Purpose | Legacy source |
| --- | --- |
| Visual configuration and settings | `lib/constants.ts`, `components/organisms/PixiSettings.tsx` |
| Pointer, autoplay, zones | `lib/pixi/pointer.ts`, `events.ts`, `autoPointer.ts`, `hitbox.ts` |
| Sprite pool and animation | `lib/pixi/stage/emitter/` |
| Cloud tail, ambient clouds, shaders | `lib/pixi/stage/clouds/` |
| Asset loading and lifecycle | `lib/pixi/spritesheet.ts`, `initStage.ts`, `system/createApp.ts`, `public/pixi/` |

Treat these as behavior and asset references, not a requirement to copy their architecture.

## Constraints

- Use TypeScript and PixiJS. GSAP may remain for useful orchestration/easing; no React runtime or React integration is needed.
- One engine instance, one canvas, and one frame driver. Keep state owned by that instance and use a small typed configuration object.
- Prefer a handful of focused modules over a framework, plugin registry, generic event bus, or ECS. No backend or persistence service.
- All emitter functionality above belongs to this phase. Do not defer the cloud/shader tail or settings to a later implementation.
- Add no pages or navigation demos. Prepare client-route persistence in the shared shell.
- No Node/unit tests, new test infrastructure, automated browser tests, or benchmark suite. The only final project validation command is `pnpm verify`; the user performs the visual smoke test.
- Preserve unrelated work. Do not migrate other legacy UI features or change verification scripts to make checks pass.

## Step 1 — Implement the runtime and visual effects

1. Add a small `lib/emitter/` runtime and `components/EmitterStage.astro`. Expose only the operations integration needs, such as initialization, configuration updates, page binding refresh, and disposal.
2. Load Pixi and visual assets on the client. Reuse the legacy sun/moon sprite artwork and required cloud/shader resources, using target-local URLs and the configured base path. Avoid Axios, React contexts, and the old global stores.
3. Preserve sprite variation, outward spread, movement inertia, gravity, rotation, skew, scale/opacity envelopes, fade-out, and randomized lifetimes.
4. Use a bounded sprite pool with a free list and an active collection. Update active particles in one loop using elapsed time and sampled spawn parameters. Avoid rebuilding many GSAP tween chains per spawn and allocating two nested containers per sprite when composed transforms suffice.
5. Preserve the procedural cloud look, pointer-following tail, and intermittent ambient cloud bursts. Generate reusable cloud textures once, or reuse equivalent static assets. Keep the shader work independent of DOM/content reveal behavior.
6. Use `ParticleContainer` where its supported properties fit, such as clouds. Retain normal sprites where individual skew is required; do not sacrifice controls merely to force everything into particles.
7. Share atlas textures, bound emission work per frame, and skip spawns when capacity is exhausted. Use a configurable render-resolution cap and logical canvas coordinates consistently. Clamp/resynchronize elapsed time after suspension; never replay a hidden tab's missed emissions.
8. Keep WebGL as the straightforward initial renderer, especially for copied GLSL cloud code. Do not add a WebGPU rewrite or custom instancing pipeline.

A single GSAP ticker driving updates/rendering is acceptable. Keep its exact callback reference for removal, and never stop or sleep the global GSAP ticker on behalf of this engine.

## Step 2 — Unify pointer input, autoplay, and zones

### Pointer and autoplay

- Pointer events record the latest position and timestamp; resolve input and emission once per frame. Calculate velocity from distance/time rather than event count.
- Feed real and automatic movement through the same emission path. Use distance-based spacing with a rate/work cap so density is stable across pointer-event rates and display refresh rates.
- Preserve autoplay on initial load and after pointer inactivity; use the legacy 200 ms idle delay as a tunable starting point. Real movement takes priority immediately.
- Replace the stepped SVG-point timeline with a continuous ellipse/orbit or similarly smooth path. Preserve the small idle orbit near the last pointer position and an initial centered demonstration.
- Reset velocity/spacing history when changing input source, returning from a hidden tab, or leaving/re-entering the viewport. Avoid connecting unrelated positions with a burst or long trail.
- Keep autoplay timing, path size, and speed separate from particle lifetimes. Pause while hidden; respect reduced motion with automatic movement off by default and a deliberate user override.
- Pointer-capability checks should replace browser-name/version checks. Touch must not block scrolling or create an uncontrolled hover stream.

### Hitboxes and deadzones

- Retain `.pixi-hitbox` and `.pixi-deadzone` hooks, or support them alongside equivalent data attributes.
- Hitboxes soften the effect for readability: smaller scale, reduced opacity, and reduced/disabled drift, following the legacy intent.
- Deadzones reject new emission candidates in their bounds; they take precedence over hitboxes. Apply the policy to both pointer and autoplay streams, including cloud candidates.
- Existing particles may finish their lifetimes; do not add expensive collision simulation or clipping to guarantee that no particle ever crosses a zone.
- Keep zone rectangles cached in the same coordinate system as pointer/canvas positions. Invalidate on the actual scroll container's scroll, resize, relevant element resize, fonts/layout readiness, and page changes. Re-measure at most once per frame when dirty.
- The target scrolls inside `<main>`; a `window.scrollend` listener alone is insufficient.
- Add clearly labeled hitbox/deadzone examples to `pages/index.astro`, and protect the settings area with a deadzone. The canvas must remain transparent to input (`pointer-events: none`) and must not obstruct normal links or controls.

## Step 3 — Put live controls directly on index.astro

Render visible controls in the normal page flow, not a modal, popup, fixed drawer, or separate settings route. Use ordinary Astro markup and native inputs with labels, current values, and a reset button. Keep binding logic small and re-bindable.

Preserve the following parameter surface. The values below are legacy starting values; keep equivalent meanings and practical ranges. Store values in meaningful units rather than routing updates through percentage-to-store selectors.

| Parameter | Legacy initial value | Behavior |
| --- | --- | --- |
| `scaleModifier` | 1 | Base sprite scale |
| `cursorRadius` | 1 | Emission footprint/burst density |
| `pointerInertia` | 1.2 | Motion carried into particles |
| `gravity` | 0 | Vertical movement bias |
| `pointerMissRate` | 0.4 | Probability of skipping an emission opportunity |
| `inDuration` | 0.14–0.4 s | Randomized entrance duration |
| `outDuration` | 0.9–1.5 s | Randomized exit duration |
| `outDelay` | 0.04–0.15 s | Delay before outward/exit motion |
| `scaleIn` | 0.5–1.9 | Entrance scale range |
| `scaleHitboxIn` | 0.1–0.3 | Scale range inside hitboxes |
| `alphaIn` | 0.1–1 | Entrance opacity range |
| `skewFrom` | -1.1–1.1 rad | Starting skew range |
| `skewTo` | -0.2–0.2 rad | Ending skew range |
| `rotationIn` | -160–160 degrees | Rotation range; legacy values are multiplied by 100 degrees |
| `pixelSpread` | 0–10 px | Additional outward spread |
| `tailOpacity` | 0.05 | Cloud tail opacity |
| `tailMissRate` | 0.9 | Probability of skipping a tail opportunity |
| `bufferCount` | 4000 | Capacity limit; a smaller safe default is acceptable |

Also expose animation/autoplay toggles and simple autoplay idle-delay, speed, and orbit-size controls. Two ordinary inputs are sufficient for a min/max range; no slider library is necessary.

Use the legacy configuration's allowed bounds as a reference, clamp invalid input, and enforce min ≤ max. Zero must remain a valid value: zero opacity/gravity must not trigger a fallback default. Start with a sensible safe capacity limit rather than blindly offering the old maximum of 40,000.

Changes apply live without recreating the canvas or renderer. Visual ranges may apply to newly emitted particles; toggles, capacity limits, and emission settings must take effect immediately. Shrinking capacity must stop further allocation and retire surplus particles safely. Keep settings in memory across client routes and restore control values from the running engine when returning to index. Local-storage persistence is not required.

## Step 4 — Persist the stage across Astro client routes

Integrate the stage into `layouts/AppShell.astro`, outside the replaceable/scrolling page content. Enable Astro's `ClientRouter` once in the shared head if not already present. Use a stable host with `transition:persist="emitter-stage"` so matching shell pages retain the same canvas and engine.

- Initialize idempotently, including while asynchronous asset initialization is pending.
- Register global engine/router listeners once. Keep per-page controls, zone elements, observers, and scroll bindings separately disposable.
- Before a DOM swap, detach references/listeners belonging to outgoing page content. Do **not** destroy the persisted engine.
- After the swap/page load, bind the new scroll container, re-discover zones, refresh dimensions, and bind controls if present. Avoid duplicate bindings across lifecycle events.
- Preserve running particles, loaded assets, autoplay state, and parameter values through navigation between pages using this shell.
- A persisted element can be temporarily disconnected while Astro moves it. Do not synchronously destroy the renderer merely because a custom element's `disconnectedCallback` fires.
- Provide complete cleanup for actual disposal/HMR: frame callback, timers, listeners, observers, particle state, shaders/textures owned by the engine, and canvas. Dispose once and handle initialization completing after disposal.
- Do not create extra routes to demonstrate persistence. Report that cross-page continuity remains for the user's smoke test when another shell page is available; implementation alone is not a verified navigation result.

## Completion and handoff

Run `pnpm verify` from the target repository after implementation. Fix failures introduced by this work; report unrelated blockers accurately. Do not run additional test/build commands or claim visual validation from static checks.

Hand off a short summary of changed files, visual deviations, parameter mappings that changed, and the exact verification result. Then wait for the user's smoke-test feedback.

User smoke checklist:

- Pointer trails, rapid direction changes, and pointer ↔ autoplay transitions.
- Sprite entrance/exit, cloud tail, and ambient clouds.
- Hitbox softening, deadzone suppression, and zone alignment while scrolling/resizing.
- Live controls, zero values, range limits, reset, and settings-area usability.
- Tab hide/resume, reduced motion, and touch/scroll behavior.
- Once another shell route exists: same canvas/engine and settings survive forward/back client navigation; returning to index restores working controls.

## API references

Check the installed versions before using APIs; keep the implementation small.

- Astro scripts: https://docs.astro.build/en/guides/client-side-scripts/
- Astro persistence and routing lifecycle: https://docs.astro.build/en/guides/view-transitions/
- PixiJS performance: https://pixijs.com/8.x/guides/concepts/performance-tips
- PixiJS particles: https://pixijs.com/8.x/guides/components/scene-objects/particle-container
- GSAP ticker ownership: https://gsap.com/docs/v3/GSAP/gsap.ticker/

