# Apollo Simulation Server

A web application for configuring, launching, and reviewing SPICE-family
circuit simulations (Xyce, ngspice) on a shared simulation server.

This repository currently contains the **Phase 1 frontend**: a complete,
navigable UI built against simulated (mock) data. It reproduces the
structure, flows, and visual language of the original design prototype,
[`Apollo Simulation Server (standalone).html`](./Apollo%20Simulation%20Server%20(standalone).html)
(a Claude Design artifact), rebuilt as a modular React/TypeScript
application instead of a single monolithic file. The prototype is kept
in the repository unmodified as the visual/functional reference.

No backend, and no real Xyce/ngspice execution, is implemented yet.

## Stack

- **React 19 + TypeScript** — UI and type safety.
- **Vite** — dev server and build tool.
- **React Router** — client-side routing (`/`, `/projects`, `/jobs`, etc.).
- **Zustand** — the one piece of global state that needs to be shared
  outside React's tree (theme preference); everything else is local
  component state or fetched through the service layer.
- **Plain CSS + CSS Modules** — a token file (`src/styles/tokens.css`)
  defines the design system as CSS custom properties, extracted from the
  prototype; component-scoped styles use CSS Modules where a class needs
  reuse or pseudo-states. Tailwind was not used: the prototype already
  encodes its design system as CSS variables, and Tailwind's utility
  classes would just be a second, redundant abstraction on top of it.
- **Lucide React** — icon set (sober line icons, matches the prototype).
- **ECharts** (`echarts/core` + `echarts-for-react/lib/core`, tree-shaken
  to only the line/grid/tooltip/legend/dataZoom/toolbox modules actually
  used) — the results charts. Chosen over Plotly for smaller bundle size
  and first-class log/linear axis toggling, zooming, and legend toggling
  out of the box.
- **Vitest + React Testing Library** — unit and component tests.
- **ESLint + Prettier** — linting and formatting.

## Project structure

```text
frontend/
├── src/
│   ├── app/            # App.tsx: router setup
│   ├── components/     # Reusable, feature-agnostic UI
│   │   ├── layout/      # AppLayout (sidebar/shell), PageHeader, buttons
│   │   ├── navigation/  # OverflowMenu, Tabs
│   │   ├── editor/      # NetlistEditor (line-numbered textarea)
│   │   ├── charts/      # ResultChart (ECharts wrapper)
│   │   └── feedback/    # Loading/Empty/Error states, ConfirmDialog, badges
│   ├── pages/           # One file per route; thin, compose features
│   ├── features/        # Page-specific logic and components
│   │   ├── projects/     # Project cards, filters, file lists, activity feed
│   │   ├── simulations/  # The 6-step "new simulation" wizard
│   │   ├── jobs/          # Job queue table, live log panel, progress bar
│   │   ├── results/       # Result tabs (summary/runs/files/logs/etc.)
│   │   └── server/        # Resource meters, simulator availability
│   ├── services/        # ProjectService, JobService, etc. + mock impls
│   ├── mocks/            # Centralized seed data (projects, jobs, results…)
│   ├── hooks/             # Data-fetching hooks (useJobs, useProjects, …)
│   ├── types/             # Domain types shared across the app
│   ├── utils/              # Pure helpers (formatting, parameter sweeps…)
│   ├── styles/              # Design tokens + global CSS
│   └── tests/                # Vitest + Testing Library specs
├── public/
├── package.json
└── vite.config.ts
```

## Installation & running

```bash
cd frontend
npm install
npm run dev       # start the dev server
npm run build     # type-check and build for production
npm run preview   # preview the production build
```

## Testing, linting, formatting

```bash
npm run test          # run the test suite once (Vitest)
npm run test:watch    # watch mode
npm run lint           # ESLint
npm run format         # Prettier — write
npm run format:check   # Prettier — check only
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Home — server status, active/queued jobs, recent projects & results |
| `/projects` | Project list — search, filter, sort, create, duplicate, archive, delete |
| `/projects/:projectId` | Project workspace — files, netlists, simulations, activity |
| `/simulations/new` | New simulation wizard (6 steps) |
| `/jobs` | Job queue |
| `/jobs/:jobId` | Live job execution view |
| `/results` | Results list (landing page for the "Resultados" nav item) |
| `/results/:simulationId` | Result detail — summary/charts/runs/files/logs/config/comparison tabs |
| `/resources` | Server resources detail |
| `/models` | Model & library files across all projects |
| `/settings` | Appearance and backend-connection info |

`/results` isn't in the minimum route list from the spec, but the sidebar
needs somewhere to send a "Resultados" click that isn't a specific
simulation id, so a small landing/list page was added.

## Architecture & mocks

The app is built against a **service layer** (`src/services`), not
against the mock data directly. Each service is defined as a TypeScript
interface (`ProjectService`, `SimulationService`, `JobService`,
`ResultService`, `ServerStatusService` in `src/services/types.ts`) with a
single in-memory mock implementation that:

- seeds itself from `src/mocks/*` (realistic EDA projects, netlists,
  parameters, jobs, and results),
- simulates network latency (`delay()`) so loading states are real and
  visible,
- mutates its in-memory data on create/duplicate/archive/delete actions,
- for jobs, runs a small ticking loop (paused via
  `document.visibilitychange` when the tab isn't visible) that advances
  progress, CPU/memory, and the live log for "running" jobs — this is
  what makes the job execution view feel live without a real backend.

Pages and features only ever import from `src/services`, never from
`src/mocks` directly. See [`docs/frontend-architecture.md`](./docs/frontend-architecture.md)
for the full breakdown of data flow, state, and design decisions.

## Connecting the real backend later

When the FastAPI backend exists, replace each mock service
implementation in `src/services/mock*.ts` with one that calls the real
API (same interface, same method signatures), and swap the export in
`src/services/index.ts`. No page or feature component should need to
change, since they only depend on the service interfaces.

## Known limitations of this phase

- No real Xyce/ngspice execution — job progress, logs, and results are
  synthetic.
- No persistence beyond the in-memory session (a refresh resets projects,
  jobs, and results — only the theme preference persists, via
  `localStorage`).
- Per-run parameter data in results is illustrative, not derived from an
  actual sweep engine.
