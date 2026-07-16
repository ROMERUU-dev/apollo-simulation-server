import { describe, expect, it } from 'vitest'
import { computeSweepSummary } from '../utils/parameterSweep'
import type { ParameterDefinition } from '../types'

function makeParam(overrides: Partial<ParameterDefinition>): ParameterDefinition {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'TEMP',
    originalValue: '27',
    unit: '°C',
    mode: 'fixed',
    fixedValue: '27',
    rangeStart: '0',
    rangeEnd: '10',
    rangeStep: '1',
    listValues: '',
    ...overrides,
  }
}

describe('computeSweepSummary', () => {
  it('multiplies the value counts of active parameters', () => {
    const temp = makeParam({
      id: 'temp',
      name: 'TEMP',
      mode: 'linear',
      rangeStart: '-40',
      rangeEnd: '125',
      rangeStep: '5',
    })
    const vdd = makeParam({ id: 'vdd', name: 'VDD', mode: 'list', listValues: '1.8, 2.5, 3.3, 5' })
    const rload = makeParam({ id: 'rload', name: 'RLOAD', mode: 'list', listValues: '10, 47, 100' })

    const summary = computeSweepSummary([temp, vdd, rload])

    const tempCount = summary.sweeps.find((s) => s.parameterId === 'temp')?.valueCount
    expect(tempCount).toBe(34)
    expect(summary.totalCombinations).toBe(tempCount! * 4 * 3)
  })

  it('excludes parameters set to "exclude" from the combination count', () => {
    const included = makeParam({ id: 'a', mode: 'list', listValues: '1, 2' })
    const excluded = makeParam({ id: 'b', mode: 'exclude' })

    const summary = computeSweepSummary([included, excluded])

    expect(summary.activeParameters).toHaveLength(1)
    expect(summary.totalCombinations).toBe(2)
  })

  it('flags a high combination count as a warning', () => {
    const big = makeParam({
      id: 'a',
      mode: 'linear',
      rangeStart: '0',
      rangeEnd: '999',
      rangeStep: '1',
    })
    const summary = computeSweepSummary([big])
    expect(summary.isHighCombinationCount).toBe(true)
  })

  it('treats fixed and original modes as a single value', () => {
    const fixed = makeParam({ id: 'a', mode: 'fixed', fixedValue: '10' })
    const original = makeParam({ id: 'b', mode: 'original', originalValue: '5' })
    const summary = computeSweepSummary([fixed, original])
    expect(summary.totalCombinations).toBe(1)
  })
})
