import { describe, expect, it } from 'vitest'
import { parseResultsCsv } from '../api/resultsCsv'

describe('generic results CSV', () => {
  it('parses finite numeric columns with a monotonic first axis', () => {
    const result = parseResultsCsv('TIME,V(out),I(R1)\n0,0,0\n0.001,0.5,0.0005\n')
    expect(result.columns).toEqual(['TIME', 'V(out)', 'I(R1)'])
    expect(result.rows).toEqual([
      [0, 0, 0],
      [0.001, 0.5, 0.0005],
    ])
  })

  it('accepts a descending DC sweep axis', () => {
    expect(parseResultsCsv('V1,V(out)\n1,0.5\n0,0\n').rows).toHaveLength(2)
  })

  it.each([
    ['NaN', 'TIME,V(out)\n0,NaN\n'],
    ['Infinity', 'TIME,V(out)\n0,Infinity\n'],
    ['duplicate headers', 'TIME,TIME\n0,1\n'],
    ['formula header', 'TIME,=cmd\n0,1\n'],
    ['incomplete row', 'TIME,V(out)\n0\n'],
    ['non-monotonic axis', 'TIME,V(out)\n0,0\n1,1\n0.5,2\n'],
    ['HTML', '<html><body>error</body></html>'],
  ])('rejects %s', (_case, csv) => {
    expect(() => parseResultsCsv(csv)).toThrow()
  })
})
