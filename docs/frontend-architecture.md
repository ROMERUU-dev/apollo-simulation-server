# Frontend architecture

Administrators receive a `Monitorización` navigation entry only after the fixed summary endpoint returns `200`. A `403` is treated as normal lack of access and leaves the entry hidden. The page polls every 15 seconds only while visible, stops after repeated errors, and uses the existing ECharts dependency for bounded history series.

This document explains how `frontend/` is put together: why it's divided
the way it is, how data flows through it, and what's deliberately left
out at this stage.

## Starting point

The reference is [`Apollo Simulation Server (standalone).html`](../Apollo%20Simulation%20Server%20(standalone).html),
a Claude Design artifact. It's a self-contained bundle (fonts, a compiled
script, and a rendered DOM snapshot inlined as a single file), not
component source — so "porting" it meant reading its design tokens,
layout structure, and the feature list in the task brief, then rebuilding
the same product decisions as a normal, modular app rather than
transcribing markup. The prototype file is left untouched in the repo
root as the visual reference; it is not part of the build.

## Directory layout and why

```
src/app/         → App.tsx: the router and lazy page registration. Nothing else.
src/pages/       → One file per route. A page wires a URL to data hooks and
                    feature components; it contains no business logic itself.
src/features/    → Where the actual page logic lives, grouped by domain
                    (projects, simulations, jobs, results, server). A feature
                    folder can have several components plus page-specific
                    hooks (e.g. the wizard's step components).
src/components/  → Reusable, domain-agnostic UI: layout shell, buttons,
                    tabs, dialogs, the netlist editor, the chart wrapper,
                    loading/empty/error states. Nothing here imports from
                    features/ or pages/.
src/services/    → The contract between UI and data. See "Data flow" below.
src/mocks/       → Static seed data only. Only services/ imports from here.
src/hooks/       → Small data-fetching hooks (useJobs, useProjects, …) that
                    wrap a service call in loading/error state, plus
                    useThemeStore for the persisted theme preference.
src/types/       → Domain types (Project, SimulationJob, ParameterDefinition,
                    …), shared by services, features, and mocks alike.
src/utils/       → Pure functions: formatting, id generation, the parameter
                    sweep/combination calculator, netlist reference
                    extraction. No React, no side effects (except `delay`,
                    used only by mock services to simulate latency).
src/styles/      → Design tokens (tokens.css) and global resets/utility
                    classes (global.css).
src/tests/       → Vitest + Testing Library specs, one file per concern.
```

The rule of thumb: **pages are thin, features hold logic, components are
reusable, services are the only door to data.** No file in `pages/` or
`features/` talks to `mocks/` directly.

## Data flow

Every domain has a matching interface in `src/services/types.ts`:
`ProjectService`, `SimulationService`, `JobService`, `ResultService`,
`ServerStatusService`. Each currently has one implementation
(`mockProjectService.ts`, etc.) that:

1. seeds an in-memory array from `src/mocks/*`,
2. exposes `async` methods that return the same shapes a real HTTP client
   would (so switching to `fetch` calls later doesn't change call sites),
3. adds a small artificial delay (`utils/delay.ts`) so loading states are
   exercised in the UI instead of resolving instantly,
4. for jobs specifically, runs a `setInterval` "ticker" that advances
   `completedRuns`, `cpuPct`, `memoryMb`, and appends log lines for any
   job in the `running` state — this is what makes `/jobs/:jobId` feel
   like a live simulation. The ticker is torn down whenever no job is
   running, and paused via the `visibilitychange` event so a backgrounded
   tab doesn't keep animating or ticking state for nothing.

Components never import a mock service directly — they import from
`src/services` (the barrel), which currently re-exports the mock
implementations. `src/hooks/*` wraps the async service calls in a
`loading` / `data` / `refresh` shape so pages can stay declarative:

```
useProjects(options) → { projects, loading, refresh }
useJobs()             → { jobs, loading, refresh }
useJob(jobId)         → { job, loading, refresh }
...
```

Mutations (create project, cancel job, …) call the service directly and
then invoke `refresh()`; there's no separate cache/store layer because
the mock services are cheap to re-fetch and the dataset is small. If a
real backend introduces the need for optimistic updates or normalized
caching, that's the natural point to introduce something like React
Query — deliberately not added now, to avoid a dependency the mock phase
doesn't need.

## State

- **Server state** (projects, jobs, results, server status) lives in the
  service layer, not in React state or a global store. Components hold
  only the current page's slice, fetched through the hooks above.
- **Local UI state** (dialog open/closed, form fields, active tab, wizard
  step) is plain `useState` in the component that owns it.
- **Cross-cutting client state**: only the theme (`light`/`dark`) is
  global enough to need Zustand (`useThemeStore`). It's read by the
  layout, the settings page, and the chart component (so ECharts text
  color follows the theme) — passing it down as props would mean
  threading it through routes that have nothing to do with theming, so a
  tiny store was the simpler option here. No other cross-cutting state
  existed that justified adding more Zustand stores.
- The **new-simulation wizard** state (`WizardState`) is `useState` inside
  `NewSimulationWizard`, one level above the six step components. Steps
  are conditionally rendered (not unmounted-and-remounted via routes), so
  moving forward/back never loses data — this is what satisfies "conserva
  el estado al avanzar o retroceder" without needing a wizard-specific
  store.

## Routing

`src/app/App.tsx` defines the route table with `react-router-dom` and
`React.lazy` per page, wrapped in a single `Suspense`. All routes render
inside `AppLayout`, which owns the sidebar (with active-route highlighting
via `NavLink`), the collapse toggle, and the theme toggle.

One addition beyond the spec's minimum route list: `/results` (no id) as
a simple list page, since the sidebar's "Resultados" entry needs
somewhere to go that isn't tied to one simulation.

## Theming

- Design tokens live in `src/styles/tokens.css` as CSS custom properties,
  scoped to `:root` (light, default) and `:root[data-theme="dark"]`.
  They were extracted from the prototype's own token block (same
  variable names, same OKLCH status colors, same Barlow/Barlow Condensed
  font stack).
- A blocking inline script in `index.html` reads `localStorage` (falling
  back to `prefers-color-scheme`) and sets `data-theme` on `<html>`
  *before* the app mounts, so there's no theme flash on load.
- `useThemeStore` (Zustand) is the single place that reads/writes
  `data-theme` and persists to `localStorage` after that.
- **One deliberate exception**: the sidebar navigation and the live log
  terminal are meant to look like fixed dark/graphite chrome in *both*
  themes (per the "navegación oscura o grafito" requirement) — they do
  not use `--color-neutral-900`, because that token is a foreground-
  contrast step that intentionally inverts between themes (dark in light
  mode, light in dark mode, for use as high-contrast text). Reusing it as
  a background nearly turned the sidebar white in dark mode. Fixed tokens
  (`--nav-bg`, `--nav-text`, `--nav-accent-text`, …) were added
  specifically for these two always-dark surfaces.
- `ResultChart` reads the theme store directly to keep ECharts' text/axis
  colors legible against either app background, since ECharts renders to
  canvas and can't pick up CSS custom properties on its own.

## Design decisions worth flagging

- **CSS Modules over Tailwind**: the prototype's design system is already
  a CSS custom-property token set; CSS Modules + those tokens map onto it
  directly. Tailwind would mean re-deriving an equivalent token
  configuration for a large dependency with mostly redundant benefit here.
- **ECharts over Plotly**: needed log/linear axis toggling, zoom, and
  legend show/hide out of the box, with a smaller tree-shaken footprint
  (`echarts/core` + only the chart/component/renderer modules used) than
  a full Plotly bundle would cost.
- **No React Query / SWR**: the mock services are synchronous-fast and
  the dataset is small; hand-rolled fetch-on-mount hooks are simpler here
  and easy to swap out later without a new dependency shaping the whole
  data layer prematurely.
- **Project association in the wizard**: the six-step spec (Netlist →
  Files → Simulator → Parameters → Execution → Review) doesn't include a
  "pick a project" step. The wizard accepts an optional `initialProjectId`
  (set when opened from a project workspace's "Nueva simulación" button)
  and otherwise lets the Review step's project selector assign one
  in-line — no extra step, no orphaned functionality.
- **Per-run data model**: `SimulationResult` stores one aggregate
  `xAxis`/`series` dataset per simulation (matching what the Charts tab
  needs) plus the job's `RunResult[]` for the Runs/Comparison tabs. A
  fully faithful per-run-per-signal dataset would be considerably heavier
  to mock convincingly and isn't needed to demonstrate the UI.

## Live job flow

Jobs and results use same-origin `/api/jobs` requests rather than the legacy
mock services. The client supports exactly `rc_lowpass_fixed_v1` and
`rc_lowpass_param_v1`, generates one idempotency key per explicit submission,
polls only non-terminal jobs, validates `waveform.csv`, and renders its complete
series with ECharts. It does not read authentication cookies or tokens and does
not persist jobs, responses, parameters, or CSV data in browser storage.

The configurable form converts visible capacitance and duration units to four
numeric SI fields before submission and checks the same ranges and RC ratio as
the backend. This client validation is for usability; backend and worker
validation remain authoritative. Projects and the older generic simulation
wizard remain non-functional placeholders and are not connected to job
execution.
