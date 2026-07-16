import type { GeneratedArtifact, SimulationResult } from '../types'
import { createId } from '../utils/id'

function range(count: number, start: number, step: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step)
}

function logRange(count: number, start: number, end: number): number[] {
  const logStart = Math.log10(start)
  const logEnd = Math.log10(end)
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1)
    return Math.pow(10, logStart + t * (logEnd - logStart))
  })
}

function buildArtifacts(prefix: string): GeneratedArtifact[] {
  return [
    {
      id: createId('artifact'),
      name: `${prefix}.raw`,
      kind: 'raw-output',
      sizeBytes: 842_112,
      createdAt: '2026-07-14T16:40:00Z',
    },
    {
      id: createId('artifact'),
      name: `${prefix}.log`,
      kind: 'log',
      sizeBytes: 21_340,
      createdAt: '2026-07-14T16:40:00Z',
    },
    {
      id: createId('artifact'),
      name: `${prefix}_report.pdf`,
      kind: 'report',
      sizeBytes: 154_880,
      createdAt: '2026-07-14T16:40:00Z',
    },
  ]
}

const timeMs = range(200, 0, 0.025)
const thermalOutput = timeMs.map(
  (t) => 6 + 5.2 * Math.sin(t * 1.4) * Math.exp(-t * 0.015) + (Math.random() - 0.5) * 0.05,
)
const thermalTempNode = timeMs.map((t) => 27 + 12 * (1 - Math.exp(-t * 0.02)))

const freqHz = logRange(120, 1e3, 1e9)
const cmosGainDb = freqHz.map((f) => 42 - 20 * Math.log10(Math.max(f / 2e6, 1)))
const cmosPhaseDeg = freqHz.map((f) => -180 * Math.atan(f / 5e6) * (2 / Math.PI))

const vgs = range(121, 0, 0.01)
const idTypical = vgs.map((v) => (v > 0.42 ? 1.2e-3 * Math.pow(v - 0.42, 2) : 1e-9))
const idFast = vgs.map((v) => (v > 0.36 ? 1.35e-3 * Math.pow(v - 0.36, 2) : 1e-9))
const idSlow = vgs.map((v) => (v > 0.48 ? 1.05e-3 * Math.pow(v - 0.48, 2) : 1e-9))

const mcRunIndex = range(210, 1, 1)
const mcOutputCurrent = mcRunIndex.map(() => 100 + (Math.random() - 0.5) * 8)

export const mockResults: SimulationResult[] = [
  {
    id: 'result-thermal-osc',
    jobId: 'job-thermal-temp-sweep',
    projectId: 'proj-thermal-osc',
    projectName: 'Oscilador térmico MOSFET',
    simulationName: 'Barrido de temperatura ambiente',
    simulatorId: 'xyce',
    createdAt: '2026-07-14T16:40:00Z',
    totalRuns: 36,
    completedRuns: 36,
    failedRuns: 0,
    warningsCount: 2,
    durationSeconds: 2880,
    xAxis: { name: 'Tiempo', unit: 'ms', values: timeMs },
    series: [
      { name: 'V(out)', unit: 'V', values: thermalOutput },
      { name: 'T(junction)', unit: '°C', values: thermalTempNode },
    ],
    artifacts: buildArtifacts('thermal_oscillator'),
  },
  {
    id: 'result-cmos-amp',
    jobId: 'job-cmos-freq-response',
    projectId: 'proj-cmos-amp',
    projectName: 'Amplificador CMOS',
    simulationName: 'Respuesta en frecuencia',
    simulatorId: 'ngspice',
    createdAt: '2026-07-12T10:12:00Z',
    totalRuns: 20,
    completedRuns: 20,
    failedRuns: 0,
    warningsCount: 0,
    durationSeconds: 1860,
    xAxis: { name: 'Frecuencia', unit: 'Hz', values: freqHz },
    series: [
      { name: 'Ganancia', unit: 'dB', values: cmosGainDb },
      { name: 'Fase', unit: '°', values: cmosPhaseDeg },
    ],
    artifacts: buildArtifacts('cmos_two_stage'),
  },
  {
    id: 'result-bsim-sweep',
    jobId: 'job-bsim-corners',
    projectId: 'proj-bsim-sweep',
    projectName: 'Barrido de modelo BSIM',
    simulationName: 'Curvas Id-Vgs por esquina',
    simulatorId: 'xyce',
    createdAt: '2026-07-08T17:00:00Z',
    totalRuns: 15,
    completedRuns: 11,
    failedRuns: 4,
    warningsCount: 4,
    durationSeconds: 1740,
    xAxis: { name: 'VGS', unit: 'V', values: vgs },
    series: [
      { name: 'ID (típico)', unit: 'A', values: idTypical },
      { name: 'ID (rápido)', unit: 'A', values: idFast },
      { name: 'ID (lento)', unit: 'A', values: idSlow },
    ],
    artifacts: buildArtifacts('bsim4_sweep'),
  },
  {
    id: 'result-mirror-mc',
    jobId: 'job-mirror-montecarlo',
    projectId: 'proj-current-mirror-mc',
    projectName: 'Monte Carlo de espejo de corriente',
    simulationName: 'Monte Carlo 500 corridas',
    simulatorId: 'ngspice',
    createdAt: '2026-06-18T09:00:00Z',
    totalRuns: 500,
    completedRuns: 210,
    failedRuns: 3,
    warningsCount: 3,
    durationSeconds: 1680,
    xAxis: { name: 'Corrida', unit: '#', values: mcRunIndex },
    series: [{ name: 'I(out)', unit: 'µA', values: mcOutputCurrent }],
    artifacts: buildArtifacts('current_mirror_mc'),
  },
]
