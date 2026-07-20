import type { RcParameters } from './jobTypes'

export const RC_LIMITS = {
  resistance_ohms: { minimum: 1, maximum: 10_000_000 },
  capacitance_farads: { minimum: 1e-12, maximum: 1e-2 },
  input_voltage_volts: { minimum: 0.001, maximum: 10 },
  duration_seconds: { minimum: 1e-6, maximum: 1 },
} as const

export const CAPACITANCE_FACTORS = {
  pF: 1e-12,
  nF: 1e-9,
  µF: 1e-6,
  mF: 1e-3,
} as const

export const DURATION_FACTORS = {
  µs: 1e-6,
  ms: 1e-3,
  s: 1,
} as const

export type CapacitanceUnit = keyof typeof CAPACITANCE_FACTORS
export type DurationUnit = keyof typeof DURATION_FACTORS

export interface RcParameterFormValues {
  resistance: string
  capacitance: string
  capacitanceUnit: CapacitanceUnit
  inputVoltage: string
  duration: string
  durationUnit: DurationUnit
}

export interface RcParameterValidation {
  parameters: RcParameters | null
  timeConstantSeconds: number | null
  durationTauRatio: number | null
  error: string | null
}

export function validateRcParameters(parameters: RcParameters): string | null {
  for (const [key, limits] of Object.entries(RC_LIMITS) as [
    keyof RcParameters,
    { minimum: number; maximum: number },
  ][]) {
    const value = parameters[key]
    if (!Number.isFinite(value) || value < limits.minimum || value > limits.maximum) {
      return 'Los parámetros están fuera de los límites permitidos.'
    }
  }
  const tau = parameters.resistance_ohms * parameters.capacitance_farads
  const ratio = parameters.duration_seconds / tau
  if (
    !Number.isFinite(tau) ||
    tau <= 0 ||
    !Number.isFinite(ratio) ||
    ratio < 0.01 ||
    ratio > 1000
  ) {
    return 'La duración debe estar entre 0.01 y 1000 constantes de tiempo.'
  }
  return null
}

function parseRequiredNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateRcParameterForm(values: RcParameterFormValues): RcParameterValidation {
  const resistance = parseRequiredNumber(values.resistance)
  const capacitanceDisplay = parseRequiredNumber(values.capacitance)
  const inputVoltage = parseRequiredNumber(values.inputVoltage)
  const durationDisplay = parseRequiredNumber(values.duration)
  if (
    resistance === null ||
    capacitanceDisplay === null ||
    inputVoltage === null ||
    durationDisplay === null
  ) {
    return {
      parameters: null,
      timeConstantSeconds: null,
      durationTauRatio: null,
      error: 'Todos los parámetros deben ser números finitos.',
    }
  }

  const parameters: RcParameters = {
    resistance_ohms: resistance,
    capacitance_farads: capacitanceDisplay * CAPACITANCE_FACTORS[values.capacitanceUnit],
    input_voltage_volts: inputVoltage,
    duration_seconds: durationDisplay * DURATION_FACTORS[values.durationUnit],
  }
  const timeConstantSeconds = parameters.resistance_ohms * parameters.capacitance_farads
  const durationTauRatio = parameters.duration_seconds / timeConstantSeconds
  const validationError = validateRcParameters(parameters)
  if (validationError) {
    return {
      parameters: null,
      timeConstantSeconds,
      durationTauRatio,
      error: validationError,
    }
  }
  return { parameters, timeConstantSeconds, durationTauRatio, error: null }
}

export function formatSi(value: number, unit: string): string {
  return `${value.toExponential(6)} ${unit}`
}
