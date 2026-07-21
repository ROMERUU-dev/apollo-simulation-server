# Legacy RC Migration

The active creation experience moves to `custom_xyce_netlist_v1`. Existing
`rc_lowpass_fixed_v1` and `rc_lowpass_param_v1` jobs remain valid, visible, and
owned by their original users.

Legacy jobs are labeled `Simulacion RC heredada` and are read-only:

- Jobs and Results continue to list them;
- detail, validated `waveform.csv` graphing, and same-origin download remain;
- there is no duplicate, rerun, edit, or migration action;
- historical `request.json` files without newer optional fields still validate;
- no existing spool, artifact, job ID, or summary is rewritten.

When `CIMASIM_ALLOW_LEGACY_RC_SUBMISSION=false`, new submissions for either RC
template return `410 Gone` with code `LEGACY_TEMPLATE_DISABLED`. They do not
return 404, and reads remain available. The flag can be restored temporarily
for rollback, but the custom frontend never enables legacy submission.

The custom spool and `results.csv` are separate from the legacy spool and
`waveform.csv`. Production keeps custom execution disabled during this PR, so
the five existing RC jobs remain untouched.
