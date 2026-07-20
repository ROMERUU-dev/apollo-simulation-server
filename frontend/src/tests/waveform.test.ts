import { describe, expect, it, vi } from 'vitest'
import {
  MAX_WAVEFORM_BYTES,
  MAX_WAVEFORM_ROWS,
  calculateWaveformMetrics,
  fetchWaveform,
  parseWaveformCsv,
} from '../api/waveform'

const JOB_ID = `job_${'3'.repeat(32)}`
const header = 'time_seconds,input_volts,output_volts'

describe('waveform CSV validation', () => {
  it('parses all 2013 finite points and computes metrics', () => {
    const rows = Array.from({ length: 2013 }, (_, index) => {
      const time = (0.005 * index) / 2012
      const input = index === 0 ? 0 : 1
      const output = 1 - Math.exp(-time / 0.001)
      return `${time},${input},${output}`
    })
    const points = parseWaveformCsv(`${header}\n${rows.join('\n')}\n`)
    const metrics = calculateWaveformMetrics(points)
    expect(points).toHaveLength(2013)
    expect(metrics.samples).toBe(2013)
    expect(metrics.durationSeconds).toBeCloseTo(0.005)
    expect(metrics.maximumInputVolts).toBe(1)
  })

  it.each([
    ['wrong header', 'time,input,output\n0,0,0'],
    ['HTML', '<html><body>login</body></html>'],
    ['incomplete row', `${header}\n0,0`],
    ['NaN', `${header}\n0,NaN,0`],
    ['Infinity', `${header}\n0,1,Infinity`],
    ['non-monotonic time', `${header}\n0.2,1,0.1\n0.1,1,0.2`],
  ])('rejects %s', (_name, csv) => {
    expect(() => parseWaveformCsv(csv)).toThrow()
  })

  it('rejects too many rows', () => {
    const rows = Array.from({ length: MAX_WAVEFORM_ROWS + 1 }, (_, index) => `${index},1,1`)
    expect(() => parseWaveformCsv(`${header}\n${rows.join('\n')}`)).toThrow()
  })

  it('fetches CSV same-origin with no-store', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(`${header}\n0,0,0\n0.005,1,0.99\n`, {
        status: 200,
        headers: { 'content-type': 'text/csv', 'content-length': '70' },
      }),
    )
    expect(await fetchWaveform(JOB_ID)).toHaveLength(2)
    expect(fetch).toHaveBeenCalledWith(
      `/api/jobs/${JOB_ID}/artifacts/waveform.csv`,
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    )
  })

  it('rejects a declared oversized artifact', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(`${header}\n0,0,0`, {
        status: 200,
        headers: {
          'content-type': 'text/csv',
          'content-length': String(MAX_WAVEFORM_BYTES + 1),
        },
      }),
    )
    await expect(fetchWaveform(JOB_ID)).rejects.toThrow(/tamaño permitido/i)
  })
})
