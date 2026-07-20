import { describe, expect, it } from 'vitest'
import {
  validateRcParameterForm,
  type CapacitanceUnit,
  type DurationUnit,
  type RcParameterFormValues,
} from '../api/rcParameters'

const base: RcParameterFormValues = {
  resistance: '1000',
  capacitance: '1',
  capacitanceUnit: 'µF',
  inputVoltage: '1',
  duration: '5',
  durationUnit: 'ms',
}

describe('bounded RC parameter conversion', () => {
  it.each([
    ['pF', 1e-12],
    ['nF', 1e-9],
    ['µF', 1e-6],
    ['mF', 1e-3],
  ] as [CapacitanceUnit, number][])('converts capacitance %s to SI', (unit, expected) => {
    const result = validateRcParameterForm({
      ...base,
      resistance: unit === 'pF' ? '10000000' : unit === 'nF' ? '1000000' : '1000',
      capacitanceUnit: unit,
      duration: unit === 'mF' ? '1000' : '5',
    })
    expect(result.parameters?.capacitance_farads).toBeCloseTo(expected)
  })

  it.each([
    ['µs', 5e-6],
    ['ms', 0.005],
    ['s', 1],
  ] as [DurationUnit, number][])('converts duration %s to SI', (unit, expected) => {
    const result = validateRcParameterForm({
      ...base,
      resistance: unit === 'µs' ? '1' : '1000',
      capacitance: unit === 's' ? '1000' : '1',
      durationUnit: unit,
      duration: unit === 's' ? '1' : '5',
    })
    expect(result.parameters?.duration_seconds).toBeCloseTo(expected)
  })

  it('calculates tau and duration ratio', () => {
    const result = validateRcParameterForm(base)
    expect(result.timeConstantSeconds).toBeCloseTo(0.001)
    expect(result.durationTauRatio).toBeCloseTo(5)
    expect(result.error).toBeNull()
  })

  it('rejects missing, non-finite, out-of-range, and physically invalid values', () => {
    const cases = [
      { ...base, resistance: '' },
      { ...base, resistance: 'Infinity' },
      { ...base, resistance: '0' },
      { ...base, inputVoltage: '11' },
      {
        ...base,
        resistance: '1',
        capacitance: '1',
        capacitanceUnit: 'pF' as const,
        duration: '1',
        durationUnit: 's' as const,
      },
    ]
    for (const values of cases) {
      expect(validateRcParameterForm(values).error).not.toBeNull()
    }
  })
})
