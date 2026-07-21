# Custom Netlist Security Boundary

`custom_xyce_netlist_v1` is a review-only feature behind
`CIMASIM_CUSTOM_NETLISTS_ENABLED=false`. It accepts circuit topology and values,
but it does not provide a general file or command execution interface.

The backend normalizes UTF-8 text through a tokenizer, statement parser,
intermediate representation, semantic checks, and fixed limits. It removes user
`.PRINT` statements and emits one controlled print statement for the requested
outputs. The dispatcher independently validates the normalized request. The
runner validates it again and adds only the fixed internal output destination
`/output/results.csv`.

The following are rejected:

- `.INCLUDE`, `.INC`, `.LIB`, plugins, control blocks, unknown directives, and
  output-file options;
- paths, URLs, NUL bytes, control characters, external models, Verilog-A, shared
  libraries, and multiple files;
- more than one primary `.TRAN`, `.DC`, or `.AC` analysis;
- requests exceeding the documented byte, line, topology, output, or result
  limits.

No expression is evaluated by Python. In particular, the implementation does
not use `eval`, `exec`, or `ast.literal_eval` for SPICE expressions. Xyce 7.10
performs the final syntax and topology preflight with its documented `-norun`
option inside the runner sandbox.

The intended execution boundary is rootless Podman under a dedicated
`cimasim-runner` system account. Each ephemeral container has no network,
read-only rootfs, no capabilities, no new privileges, 1 CPU, 1 GiB RAM, 64
PIDs, a bounded tmpfs, and only one read-only input directory plus one empty
read-write output directory. It receives no Docker socket, complete spool,
secret, host device, Apollo mount, or user-selected command.

The target host did not have Podman, `newuidmap`, the dedicated account, or
subuid/subgid delegation during this review. Production execution must remain
disabled until that administrative gate and the isolation smoke tests pass.
