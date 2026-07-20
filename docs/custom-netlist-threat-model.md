# Custom Netlist Threat Model

## Protected assets

- Apollo and DICOM availability and data;
- backend authentication configuration and user identities;
- host files, devices, processes, networks, and other jobs;
- integrity of legacy and custom job histories.

## Untrusted input

The job name, netlist text, and requested outputs are untrusted. Likely attacks
include parser denial of service, path or directive injection, unsafe Xyce
features, output amplification, resource exhaustion, cross-job reads, and
secret extraction through logs or artifacts.

## Controls

- strict request schemas and idempotency;
- bounded parsing without Python expression evaluation;
- directive and option allowlists plus explicit file/plugin/control denials;
- independent validation in backend, dispatcher, and runner;
- fixed Xyce 7.10 executable, `-norun` preflight, and fixed output path;
- rootless ephemeral container with no network, capabilities, devices, sockets,
  host namespaces, complete spool, or secrets;
- 1 CPU, 1 GiB RAM, 64 PIDs, 60 seconds, bounded files and result validation;
- aggregate metrics without job, user, netlist, node, model, or output labels;
- sanitized errors and no netlists or raw Xyce output in logs.

## Residual risks

Xyce is a complex native parser and simulator. A parser escape or native Xyce
vulnerability remains possible, so application validation is not the sole
boundary. Rootless user namespaces, read-only mounts, no network, cgroup limits,
and per-job directory isolation are mandatory before enablement. Retention
enforcement and alert thresholds also require a later deployment gate.
