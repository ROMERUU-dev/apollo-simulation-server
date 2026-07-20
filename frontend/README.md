# CimaSim Frontend

The new simulation route presents the bounded custom Xyce editor. It performs
same-origin preflight, submits `custom_xyce_netlist_v1` with one idempotency key
per user action, polls the resulting job, validates generic `results.csv`, and
graphs selected numeric columns with the existing ECharts dependency.

Historical fixed and parameterized RC jobs remain visible as read-only results
with their original `waveform.csv` graphs and downloads. No job, identity,
cookie, JWT, or netlist response is persisted in browser storage, and the client
does not create Authorization or Cloudflare assertion headers.

Custom execution is disabled unless backend health reports
`features.custom_netlists=available`; the editor can show bounded preflight
feedback while execution remains gated.

Use Node 24 through the repository NVM configuration, then run:

```bash
npm ci
npm run format:check
npm run lint
npm run test
npm run build
```

The live job UI calls the authenticated same-origin `/api/jobs` routes. New
submissions use the bounded custom contract. The client sends netlist text only
as the `netlist` JSON field and never sends model files, includes, commands,
paths, simulator options, or output filenames.

The frontend does not construct authorization headers, inspect cookies, or
store identity, jobs, netlists, idempotency keys, or result data in
`localStorage` or `sessionStorage`. Cloudflare Access and backend validation
remain authoritative.
