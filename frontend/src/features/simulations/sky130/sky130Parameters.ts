import { SKY130_DEFAULTS, type Sky130FloatingBulkParameters } from '../../../api/jobTypes'

// Client-side unit conversion and range checks for the SKY130 form. This is
// UX convenience only: the backend Sky130FloatingBulkParameters model and the
// runner's independent revalidation remain the sole security boundary. These
// limits mirror them so the form fails fast, but a stricter/looser value here
// changes nothing about what the server will actually accept.

export const CURRENT_UNITS = { nA: 1e-9, 'µA': 1e-6, mA: 1e-3, A: 1 } as const
export const TIME_UNITS = { ns: 1e-9, 'µs': 1e-6, ms: 1e-3, s: 1 } as const
export const SHORT_TIME_UNITS = { ns: 1e-9, 'µs': 1e-6, ms: 1e-3 } as const

export type CurrentUnit = keyof typeof CURRENT_UNITS
export type TimeUnit = keyof typeof TIME_UNITS
export type ShortTimeUnit = keyof typeof SHORT_TIME_UNITS

export const SKY130_LIMITS = {
  l_um: { min: 0, max: 100, exclusiveMin: true },
  w_um: { min: 0, max: 100, exclusiveMin: true },
  nf: { min: 1, max: 64, exclusiveMin: false },
  iin_a: { min: 0, max: 1e-3, exclusiveMin: true },
  cpar_f: { min: 0, max: 1e-6, exclusiveMin: true },
  rgate_ohm: { min: 1, max: 1e18, exclusiveMin: false },
  rbulk_ohm: { min: 1, max: 1e18, exclusiveMin: false },
  cgate_f: { min: 0, max: 1e-6, exclusiveMin: true },
  cbulk_f: { min: 0, max: 1e-6, exclusiveMin: true },
  temperature_celsius: { min: -100, max: 200, exclusiveMin: false },
  tstop_seconds: { min: 0, max: 1, exclusiveMin: true },
  output_interval_seconds: { min: 0, max: 1e-3, exclusiveMin: true },
} as const

export type Sky130FieldName = keyof typeof SKY130_LIMITS

const FIELD_LABELS: Record<Sky130FieldName, string> = {
  l_um: 'L',
  w_um: 'W',
  nf: 'nf',
  iin_a: 'IIN',
  cpar_f: 'CPAR',
  rgate_ohm: 'RGATE',
  rbulk_ohm: 'RBULK',
  cgate_f: 'CGATE',
  cbulk_f: 'CBULK',
  temperature_celsius: 'Temperatura',
  tstop_seconds: 'Tstop',
  output_interval_seconds: 'Output interval',
}

export interface Sky130FormState {
  lUm: string
  wUm: string
  nf: string
  iinMagnitude: string
  iinUnit: CurrentUnit
  rgateOhm: string
  rbulkOhm: string
  cparF: string
  cgateF: string
  cbulkF: string
  temperatureCelsius: string
  tstopMagnitude: string
  tstopUnit: TimeUnit
  outputIntervalMagnitude: string
  outputIntervalUnit: ShortTimeUnit
}

function magnitudeAndUnit<U extends string>(
  valueInBaseUnits: number,
  units: Record<U, number>,
  preferred: U,
): { magnitude: string; unit: U } {
  const factor = units[preferred]
  return { magnitude: String(valueInBaseUnits / factor), unit: preferred }
}

export function defaultSky130FormState(): Sky130FormState {
  const d = SKY130_DEFAULTS
  const iin = magnitudeAndUnit(d.iin_a, CURRENT_UNITS, 'nA')
  const tstop = magnitudeAndUnit(d.tstop_seconds, TIME_UNITS, 'ms')
  const outputInterval = magnitudeAndUnit(d.output_interval_seconds, SHORT_TIME_UNITS, 'ns')
  return {
    lUm: String(d.l_um),
    wUm: String(d.w_um),
    nf: String(d.nf),
    iinMagnitude: iin.magnitude,
    iinUnit: iin.unit,
    rgateOhm: String(d.rgate_ohm),
    rbulkOhm: String(d.rbulk_ohm),
    cparF: String(d.cpar_f),
    cgateF: String(d.cgate_f),
    cbulkF: String(d.cbulk_f),
    temperatureCelsius: String(d.temperature_celsius),
    tstopMagnitude: tstop.magnitude,
    tstopUnit: tstop.unit,
    outputIntervalMagnitude: outputInterval.magnitude,
    outputIntervalUnit: outputInterval.unit,
  }
}

function toNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function checkLimit(name: Sky130FieldName, value: number | null): string | null {
  if (value === null) return `${FIELD_LABELS[name]} debe ser un número.`
  const limit = SKY130_LIMITS[name]
  const tooLow = limit.exclusiveMin ? value <= limit.min : value < limit.min
  if (tooLow || value > limit.max) {
    return `${FIELD_LABELS[name]} está fuera del rango permitido.`
  }
  return null
}

export interface Sky130Resolved {
  parameters: Sky130FloatingBulkParameters | null
  error: string | null
}

/** Converts form strings to SI values and range-checks them client-side. */
export function resolveSky130Form(form: Sky130FormState): Sky130Resolved {
  const l_um = toNumber(form.lUm)
  const w_um = toNumber(form.wUm)
  const nfValue = toNumber(form.nf)
  const iin_a = toNumber(form.iinMagnitude) === null
    ? null
    : (toNumber(form.iinMagnitude) as number) * CURRENT_UNITS[form.iinUnit]
  const rgate_ohm = toNumber(form.rgateOhm)
  const rbulk_ohm = toNumber(form.rbulkOhm)
  const cpar_f = toNumber(form.cparF)
  const cgate_f = toNumber(form.cgateF)
  const cbulk_f = toNumber(form.cbulkF)
  const temperature_celsius = toNumber(form.temperatureCelsius)
  const tstop_seconds = toNumber(form.tstopMagnitude) === null
    ? null
    : (toNumber(form.tstopMagnitude) as number) * TIME_UNITS[form.tstopUnit]
  const output_interval_seconds = toNumber(form.outputIntervalMagnitude) === null
    ? null
    : (toNumber(form.outputIntervalMagnitude) as number) *
      SHORT_TIME_UNITS[form.outputIntervalUnit]

  const nf = nfValue !== null && Number.isInteger(nfValue) ? nfValue : null

  const checks: [Sky130FieldName, number | null][] = [
    ['l_um', l_um],
    ['w_um', w_um],
    ['nf', nf],
    ['iin_a', iin_a],
    ['rgate_ohm', rgate_ohm],
    ['rbulk_ohm', rbulk_ohm],
    ['cpar_f', cpar_f],
    ['cgate_f', cgate_f],
    ['cbulk_f', cbulk_f],
    ['temperature_celsius', temperature_celsius],
    ['tstop_seconds', tstop_seconds],
    ['output_interval_seconds', output_interval_seconds],
  ]
  for (const [name, value] of checks) {
    const error = checkLimit(name, value)
    if (error) return { parameters: null, error }
  }
  if (
    output_interval_seconds !== null &&
    tstop_seconds !== null &&
    output_interval_seconds > tstop_seconds
  ) {
    return { parameters: null, error: 'Output interval no puede superar a Tstop.' }
  }
  return {
    parameters: {
      device: 'sky130_fd_pr__nfet_g5v0d10v5',
      corner: 'tt',
      l_um: l_um as number,
      w_um: w_um as number,
      nf: nf as number,
      iin_a: iin_a as number,
      cpar_f: cpar_f as number,
      rgate_ohm: rgate_ohm as number,
      rbulk_ohm: rbulk_ohm as number,
      cgate_f: cgate_f as number,
      cbulk_f: cbulk_f as number,
      temperature_celsius: temperature_celsius as number,
      tstop_seconds: tstop_seconds as number,
      output_interval_seconds: output_interval_seconds as number,
    },
    error: null,
  }
}
