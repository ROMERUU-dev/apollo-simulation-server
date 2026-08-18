# Supported Custom Xyce Syntax

This phase targets Xyce 7.10 and a deliberately bounded subset. It is not a
claim of compatibility with every SPICE or ngspice netlist. The implementation
was checked against the Xyce 7.10 User Guide, Reference Guide, and the installed
`Xyce -h` output.

## Accepted structure

- devices beginning with `R`, `C`, `L`, `V`, `I`, `D`, `Q`, `M`, `J`, `B`,
  `S`, `W`, `E`, `F`, `G`, `H`, or `X`;
- inline `.MODEL` for bounded `NMOS` and `PMOS` level-style models with an
  allowlisted parameter set;
- `.PARAM`, `.FUNC`, `.SUBCKT`, `.ENDS`, `.IC`, `.NODESET`, bounded `.OPTIONS`,
  `.PRINT`, and `.END`;
- exactly one `.TRAN`, `.DC`, or `.AC` analysis;
- comments beginning with `*` and continuation lines beginning with `+`;
- requested outputs in bounded `V(node)`, `V(node,node)`, or `I(device)` form.

User-supplied safe `.OPTIONS` packages are initially limited to `TIMEINT` and
`NONLIN`. The backend may also insert one generated `.OPTIONS DEVICE TEMP=<C>`
from the structured `temperature_celsius` field. User-supplied `.TEMP` is
rejected because Xyce 7.10 treats it as an unrecognized dot line in host
validation; accepting it would not provide a reliable thesis temperature.
Adding syntax requires parser, runner, corpus, and threat-model review.

## Hard limits

| Item | Limit |
|---|---:|
| UTF-8 netlist | 64 KiB |
| Physical lines | 2,000 |
| Characters per line | 512 |
| Devices | 512 |
| Nodes | 256 |
| Models | 64 |
| Model parameters per model | 32 |
| Subcircuits | 32 |
| Subcircuit depth | 8 |
| Requested outputs | 64 |

## Explicitly unsupported

`.INCLUDE`, `.INC`, `.LIB`, `.TEMP`, external paths, attached models, plugins,
Verilog-A, shared libraries, control blocks, shell commands, URLs,
user-selected output files, multiple analyses, multiple input files, unknown
directives, and non-allowlisted model families or parameters are rejected.

The normalized netlist contains one internally generated `.PRINT` statement.
For DC it also places the single validated sweep source first because Xyce does
not add that axis automatically.
The runner adds the fixed `FILE=/output/results.csv` destination only after its
independent validation. Xyce 7.10 emits AC values as explicit real and imaginary
columns, for example `FREQ`, `Re(V(OUT))`, and `Im(V(OUT))`; CimaSim preserves
those numeric columns rather than inventing a complex-number encoding.

Official references:

- https://xyce.sandia.gov/documentation-tutorials/
- Xyce 7.10 User Guide
- Xyce 7.10 Reference Guide
