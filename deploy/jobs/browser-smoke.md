# Authenticated browser smoke test

Run this only in the developer console for `https://sim.cimasim.online` after
Cloudflare Access authentication. It uses same-origin relative requests and
does not read or set cookies, JWTs, authorization headers, or Cloudflare
assertion headers.

```js
const body = {
  name: "Prueba RC fija",
  template_id: "rc_lowpass_fixed_v1",
};
const idempotencyKey = crypto.randomUUID();

async function createJob() {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

const first = await createJob();
const repeated = await createJob();
console.log({
  firstStatus: first.status,
  repeatedStatus: repeated.status,
  sameJob: first.data.job_id === repeated.data.job_id,
  jobId: first.data.job_id,
});

const jobId = first.data.job_id;
let job;
for (let attempt = 0; attempt < 45; attempt += 1) {
  const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
  job = await response.json();
  if (["succeeded", "failed", "timed_out"].includes(job.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log({ status: job.status, summary: job.summary });

const artifactsResponse = await fetch(`/api/jobs/${jobId}/artifacts`, {
  cache: "no-store",
});
console.log({
  artifactsStatus: artifactsResponse.status,
  artifacts: await artifactsResponse.json(),
});
window.open(`/api/jobs/${jobId}/artifacts/waveform.csv`, "_blank", "noopener");
```

Expected: first POST `201`, repeated POST `200`, the same job ID, terminal
status `succeeded`, simulator `xyce`, template `rc_lowpass_fixed_v1`, about
2013 samples, simulated duration about `0.005` seconds, and a downloaded CSV
with `time_seconds,input_volts,output_volts`. `GET /api/jobs` should list the
job only for the authenticated user.

Report only HTTP status codes, job ID, final status, sample count, and whether
the CSV downloaded. Never copy cookies, JWTs, assertion values, or private
headers.
