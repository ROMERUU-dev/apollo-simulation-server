# CimaSim Frontend

Use Node 24 through the repository NVM configuration, then run:

```bash
npm ci
npm run format:check
npm run lint
npm run test
npm run build
```

The live job UI calls the authenticated same-origin `/api/jobs` routes. It
supports the fixed `rc_lowpass_fixed_v1` template and the educational
`rc_lowpass_param_v1` template. The latter converts UI units to bounded numeric
SI values for resistance, capacitance, input voltage, and duration. It never
sends textual units, netlists, models, includes, commands, paths, or simulator
options.

The frontend does not construct authorization headers, inspect cookies, or
store identity, jobs, parameters, idempotency keys, or waveform data in
`localStorage` or `sessionStorage`. Cloudflare Access and backend validation
remain authoritative.
