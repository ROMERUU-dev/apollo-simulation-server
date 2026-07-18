# Apollo Simulation Server

A web application for configuring, launching, and reviewing SPICE-family
circuit simulations (Xyce, ngspice) on a shared simulation server.

This repository currently contains the CimaSim frontend, the first FastAPI
backend phase, and internal deployment configuration. The public preview uses
Cloudflare Access and calls the backend only for authenticated identity and
health. Projects, jobs, results, uploads, and simulator execution remain
disabled until their APIs exist.

The frontend reproduces the structure, flows, and visual language of the
original design prototype,
[`Apollo Simulation Server (standalone).html`](./Apollo%20Simulation%20Server%20(standalone).html)
(a Claude Design artifact), rebuilt as a modular React/TypeScript
application instead of a single monolithic file. The prototype is kept
in the repository unmodified as the visual/functional reference.

No real Xyce/ngspice execution is implemented yet.

## Stack

- **Node.js 24 LTS** — required for the frontend toolchain. Node 18 is not
  compatible with the current Vite/Vitest/Rolldown stack.
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
│   ├── services/        # ProjectService, JobService, etc. + live/empty impls
│   ├── mocks/            # Test/dev seed data retained outside production exports
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
nvm use
cd frontend
npm ci
npm run dev       # start the dev server
npm run build     # type-check and build for production
npm run preview   # preview the production build
```

Do not use `sudo npm`. The host may keep `/usr/bin/node` on Node 18 for system
compatibility, but repository work should use the Node 24 version selected by
`.nvmrc`. Production preview images build the frontend inside Docker and serve
the final static files from Nginx; Node is not part of the runtime image.

## Testing, linting, formatting

```bash
nvm use
cd frontend
npm ci
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

## Architecture & data sources

The app is built against a **service layer** (`src/services`), not
against the mock data directly. Each service is defined as a TypeScript
interface (`ProjectService`, `SimulationService`, `JobService`,
`ResultService`, `ServerStatusService` in `src/services/types.ts`). Production
exports use live empty/unavailable implementations until real project, job, and
result APIs exist.

Pages and features only ever import from `src/services`, never from
`src/mocks` directly. See [`docs/frontend-architecture.md`](./docs/frontend-architecture.md)
for the full breakdown of data flow, state, and design decisions.

The browser calls the real backend only through same-origin endpoints:

- `GET /api/me`
- `GET /api/health`

Cloudflare Access handles authentication at the edge. Frontend JavaScript does
not create JWTs, read cookies, or persist identity in browser storage.

## Known limitations of this phase

- No real Xyce/ngspice execution.
- No project, job, result, upload, artifact, queue, or worker API is enabled.
- Project, job, and result surfaces intentionally show empty states.
- Only the theme preference persists in `localStorage`; identity is not stored
  persistently by the frontend.
