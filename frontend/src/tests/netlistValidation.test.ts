import { describe, expect, it } from 'vitest'
import { simulationService } from '../services'

describe('simulationService.validateNetlist', () => {
  it('rejects empty content', () => {
    const result = simulationService.validateNetlist('   \n  ')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/vacío/i)
  })

  it('rejects content without a .END directive', () => {
    const result = simulationService.validateNetlist('VDD vdd 0 DC 5\nR1 vdd 0 1k')
    expect(result.valid).toBe(false)
  })

  it('accepts a well-formed netlist', () => {
    const result = simulationService.validateNetlist('VDD vdd 0 DC 5\nR1 vdd 0 1k\n.END\n')
    expect(result.valid).toBe(true)
  })
})
