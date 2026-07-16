import type { ServerStatus } from '../types'

export const mockServerStatus: ServerStatus = {
  hostname: 'apollo-hpz8-01',
  model: 'HP Z8 G4',
  online: true,
  resources: {
    cpuThreadsTotal: 56,
    cpuThreadsReserved: 8,
    cpuThreadsUsedPct: 42,
    ramTotalGb: 48,
    ramUsedGb: 19.2,
    storageTotalGb: 4096,
    storageUsedGb: 2734,
  },
  simulators: [
    {
      id: 'xyce',
      name: 'Xyce',
      version: '7.10.0',
      available: true,
      description:
        'Simulador de circuitos de alto rendimiento con soporte para ejecución paralela distribuida.',
    },
    {
      id: 'ngspice',
      name: 'ngspice',
      version: '42',
      available: true,
      description:
        'Simulador de circuitos de propósito general, compatible con SPICE3 y ampliamente utilizado en la industria.',
    },
  ],
  activeJobsCount: 2,
  queuedJobsCount: 3,
}
