import type { ParameterDefinition, ParameterSweep } from '../types'

const MAX_LISTED_VALUES = 12
export const HIGH_COMBINATION_WARNING_THRESHOLD = 500

function parseNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function computeParameterSweep(parameter: ParameterDefinition): ParameterSweep {
  switch (parameter.mode) {
    case 'fixed':
      return {
        parameterId: parameter.id,
        valueCount: 1,
        values: [parameter.fixedValue || parameter.originalValue],
      }
    case 'original':
      return {
        parameterId: parameter.id,
        valueCount: 1,
        values: [parameter.originalValue],
      }
    case 'exclude':
      return { parameterId: parameter.id, valueCount: 0, values: [] }
    case 'list': {
      const values = parameter.listValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      return {
        parameterId: parameter.id,
        valueCount: Math.max(values.length, 1),
        values: values.length > 0 ? values : [parameter.originalValue],
      }
    }
    case 'linear':
    case 'log': {
      const start = parseNumber(parameter.rangeStart)
      const end = parseNumber(parameter.rangeEnd)
      const step = parseNumber(parameter.rangeStep)
      if (step <= 0 || end === start) {
        return {
          parameterId: parameter.id,
          valueCount: 1,
          values: [String(start)],
          warning: step <= 0 ? 'El paso debe ser mayor que cero.' : undefined,
        }
      }
      const count = Math.floor(Math.abs(end - start) / step) + 1
      const values: string[] = []
      const previewCount = Math.min(count, MAX_LISTED_VALUES)
      for (let i = 0; i < previewCount; i += 1) {
        const value =
          parameter.mode === 'log'
            ? start * Math.pow(end / start || 1, i / Math.max(count - 1, 1))
            : start + i * step * Math.sign(end - start || 1)
        values.push(value.toPrecision(4))
      }
      return { parameterId: parameter.id, valueCount: count, values }
    }
    default:
      return { parameterId: parameter.id, valueCount: 1, values: [parameter.originalValue] }
  }
}

export interface SweepSummary {
  sweeps: ParameterSweep[]
  activeParameters: ParameterDefinition[]
  totalCombinations: number
  isHighCombinationCount: boolean
}

export function computeSweepSummary(parameters: ParameterDefinition[]): SweepSummary {
  const activeParameters = parameters.filter((p) => p.mode !== 'exclude')
  const sweeps = activeParameters.map(computeParameterSweep)
  const totalCombinations = sweeps.reduce(
    (total, sweep) => total * Math.max(sweep.valueCount, 1),
    1,
  )
  return {
    sweeps,
    activeParameters,
    totalCombinations,
    isHighCombinationCount: totalCombinations >= HIGH_COMBINATION_WARNING_THRESHOLD,
  }
}

export function describeCombinations(
  parameters: ParameterDefinition[],
  sweeps: ParameterSweep[],
): string {
  const parts = parameters
    .filter((p) => p.mode !== 'exclude')
    .map((p) => {
      const sweep = sweeps.find((s) => s.parameterId === p.id)
      return `${sweep?.valueCount ?? 1} ${p.name}`
    })
  return parts.join(' × ')
}
