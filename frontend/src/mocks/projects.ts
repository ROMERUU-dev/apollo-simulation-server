import type { Project } from '../types'

const thermalOscillatorNetlist = `* Oscilador termico con MOSFET de potencia
.TEMP 27
VDD vdd 0 DC 12
M1 out gate vdd vdd PMOS_POWER W=500u L=0.5u
M2 out gate 0 0 NMOS_POWER W=250u L=0.5u
RTH out thnode 1k
CTH thnode 0 10u
RLOAD out 0 47
.MODEL PMOS_POWER PMOS (LEVEL=1 VTO=-0.9 KP=25u)
.MODEL NMOS_POWER NMOS (LEVEL=1 VTO=0.9 KP=55u)
.TRAN 1u 5m
.END
`

const cmosAmplifierNetlist = `* Amplificador CMOS de dos etapas
VDD vdd 0 DC 1.8
VIN in 0 DC 0.9 AC 1
M1 outA in vdd vdd PMOS_1V8 W=20u L=0.18u
M2 outA bias 0 0 NMOS_1V8 W=10u L=0.18u
M3 out outA vdd vdd PMOS_1V8 W=40u L=0.18u
M4 out bias2 0 0 NMOS_1V8 W=20u L=0.18u
CLOAD out 0 2p
.MODEL PMOS_1V8 PMOS (LEVEL=49 VTH0=-0.42)
.MODEL NMOS_1V8 NMOS (LEVEL=49 VTH0=0.42)
.AC DEC 20 1k 1G
.END
`

const capacitiveLoadInverterNetlist = `* Inversor CMOS con carga capacitiva variable
VDD vdd 0 DC 3.3
VIN in 0 PULSE(0 3.3 0 1n 1n 10n 20n)
MP out in vdd vdd PMOS_STD W=8u L=0.35u
MN out in 0 0 NMOS_STD W=4u L=0.35u
CLOAD out 0 5p
RLOAD out 0 10k
.MODEL PMOS_STD PMOS (LEVEL=3 VTO=-0.75)
.MODEL NMOS_STD NMOS (LEVEL=3 VTO=0.75)
.TRAN 0.1n 200n
.END
`

const bsimSweepNetlist = `* Barrido de modelo BSIM4 sobre transistor de prueba
.INCLUDE bsim4_typical.mod
VDS drain 0 DC 1.2
VGS gate 0 DC 0.6
VSS source 0 DC 0
M1 drain gate source source NMOS_BSIM4 W=1u L=0.13u
.DC VGS 0 1.2 0.01
.END
`

const currentMirrorMonteCarloNetlist = `* Monte Carlo de espejo de corriente
VDD vdd 0 DC 5
IREF vdd ref 100u
M1 ref ref 0 0 NMOS_MC W=5u L=1u
M2 out ref 0 0 NMOS_MC W=5u L=1u
RLOAD vdd out 10k
.MODEL NMOS_MC NMOS (LEVEL=1 VTO=0.7 DEV/GAUSS 5%)
.DC IREF 50u 150u 5u
.END
`

export const mockProjects: Project[] = [
  {
    id: 'proj-thermal-osc',
    name: 'Oscilador térmico MOSFET',
    description:
      'Estudio de la retroalimentación térmica en un MOSFET de potencia y su efecto en la estabilidad del oscilador de relajación.',
    tags: ['potencia', 'térmico', 'MOSFET'],
    status: 'active',
    createdAt: '2026-05-02T09:15:00Z',
    updatedAt: '2026-07-14T16:40:00Z',
    netlists: [
      {
        id: 'nl-thermal-osc-1',
        name: 'thermal_oscillator.cir',
        content: thermalOscillatorNetlist,
        createdAt: '2026-05-02T09:20:00Z',
        updatedAt: '2026-07-10T11:05:00Z',
        sizeBytes: thermalOscillatorNetlist.length,
      },
    ],
    modelFiles: [
      {
        id: 'mf-thermal-1',
        name: 'power_mosfet.lib',
        kind: 'lib',
        sizeBytes: 18422,
        referencedInNetlist: false,
        missing: false,
        uploadedAt: '2026-05-02T09:22:00Z',
      },
    ],
    simulationIds: ['sim-thermal-osc-1'],
    activity: [
      {
        id: 'act-thermal-1',
        message: 'Simulación "Barrido de temperatura ambiente" completada',
        timestamp: '2026-07-14T16:40:00Z',
        kind: 'simulation',
      },
      {
        id: 'act-thermal-2',
        message: 'Netlist thermal_oscillator.cir editado',
        timestamp: '2026-07-10T11:05:00Z',
        kind: 'edit',
      },
      {
        id: 'act-thermal-3',
        message: 'Proyecto creado',
        timestamp: '2026-05-02T09:15:00Z',
        kind: 'created',
      },
    ],
  },
  {
    id: 'proj-cmos-amp',
    name: 'Amplificador CMOS',
    description:
      'Caracterización en frecuencia de un amplificador CMOS de dos etapas con realimentación en modo de tensión.',
    tags: ['analógico', 'CMOS', 'amplificador'],
    status: 'active',
    createdAt: '2026-04-18T13:00:00Z',
    updatedAt: '2026-07-12T10:12:00Z',
    netlists: [
      {
        id: 'nl-cmos-amp-1',
        name: 'cmos_two_stage.cir',
        content: cmosAmplifierNetlist,
        createdAt: '2026-04-18T13:05:00Z',
        updatedAt: '2026-07-11T08:30:00Z',
        sizeBytes: cmosAmplifierNetlist.length,
      },
    ],
    modelFiles: [
      {
        id: 'mf-cmos-1',
        name: 'cmos18_models.lib',
        kind: 'lib',
        sizeBytes: 52310,
        referencedInNetlist: true,
        missing: false,
        uploadedAt: '2026-04-18T13:07:00Z',
      },
    ],
    simulationIds: ['sim-cmos-amp-1'],
    activity: [
      {
        id: 'act-cmos-1',
        message: 'Simulación "Respuesta en frecuencia" completada',
        timestamp: '2026-07-12T10:12:00Z',
        kind: 'simulation',
      },
      {
        id: 'act-cmos-2',
        message: 'Proyecto creado',
        timestamp: '2026-04-18T13:00:00Z',
        kind: 'created',
      },
    ],
  },
  {
    id: 'proj-inverter-cload',
    name: 'Inversor con carga capacitiva',
    description:
      'Análisis del tiempo de propagación de un inversor CMOS estándar frente a variaciones de carga capacitiva y resistiva.',
    tags: ['digital', 'inversor', 'timing'],
    status: 'active',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-07-15T09:22:00Z',
    netlists: [
      {
        id: 'nl-inverter-1',
        name: 'inverter_cload.cir',
        content: capacitiveLoadInverterNetlist,
        createdAt: '2026-06-01T08:10:00Z',
        updatedAt: '2026-07-15T09:22:00Z',
        sizeBytes: capacitiveLoadInverterNetlist.length,
      },
    ],
    modelFiles: [
      {
        id: 'mf-inverter-1',
        name: 'std_cmos35.model',
        kind: 'model',
        sizeBytes: 9110,
        referencedInNetlist: true,
        missing: false,
        uploadedAt: '2026-06-01T08:12:00Z',
      },
    ],
    simulationIds: ['sim-inverter-1'],
    activity: [
      {
        id: 'act-inverter-1',
        message: 'Trabajo "Barrido CLOAD/RLOAD" en ejecución',
        timestamp: '2026-07-15T09:22:00Z',
        kind: 'simulation',
      },
      {
        id: 'act-inverter-2',
        message: 'Proyecto creado',
        timestamp: '2026-06-01T08:00:00Z',
        kind: 'created',
      },
    ],
  },
  {
    id: 'proj-bsim-sweep',
    name: 'Barrido de modelo BSIM',
    description:
      'Extracción de curvas Id-Vgs sobre un transistor de prueba usando el modelo BSIM4 típico de la librería de fundición.',
    tags: ['BSIM4', 'caracterización', 'DC'],
    status: 'active',
    createdAt: '2026-03-22T14:30:00Z',
    updatedAt: '2026-07-08T17:00:00Z',
    netlists: [
      {
        id: 'nl-bsim-1',
        name: 'bsim4_sweep.cir',
        content: bsimSweepNetlist,
        createdAt: '2026-03-22T14:35:00Z',
        updatedAt: '2026-07-05T12:00:00Z',
        sizeBytes: bsimSweepNetlist.length,
      },
    ],
    modelFiles: [
      {
        id: 'mf-bsim-1',
        name: 'bsim4_typical.mod',
        kind: 'mod',
        sizeBytes: 130422,
        referencedInNetlist: true,
        missing: false,
        uploadedAt: '2026-03-22T14:36:00Z',
      },
      {
        id: 'mf-bsim-2',
        name: 'bsim4_corners.inc',
        kind: 'inc',
        sizeBytes: 4210,
        referencedInNetlist: false,
        missing: true,
        uploadedAt: '2026-03-22T14:36:00Z',
      },
    ],
    simulationIds: ['sim-bsim-1'],
    activity: [
      {
        id: 'act-bsim-1',
        message: 'Simulación "Curvas Id-Vgs por esquina" completada',
        timestamp: '2026-07-08T17:00:00Z',
        kind: 'simulation',
      },
      {
        id: 'act-bsim-2',
        message: 'Proyecto creado',
        timestamp: '2026-03-22T14:30:00Z',
        kind: 'created',
      },
    ],
  },
  {
    id: 'proj-current-mirror-mc',
    name: 'Monte Carlo de espejo de corriente',
    description:
      'Análisis estadístico de la precisión de un espejo de corriente simple ante variaciones de proceso mediante Monte Carlo.',
    tags: ['Monte Carlo', 'estadístico', 'matching'],
    status: 'archived',
    createdAt: '2026-02-10T11:00:00Z',
    updatedAt: '2026-06-20T15:45:00Z',
    netlists: [
      {
        id: 'nl-mirror-1',
        name: 'current_mirror_mc.cir',
        content: currentMirrorMonteCarloNetlist,
        createdAt: '2026-02-10T11:05:00Z',
        updatedAt: '2026-06-18T09:00:00Z',
        sizeBytes: currentMirrorMonteCarloNetlist.length,
      },
    ],
    modelFiles: [
      {
        id: 'mf-mirror-1',
        name: 'process_variation.lib',
        kind: 'lib',
        sizeBytes: 21344,
        referencedInNetlist: false,
        missing: false,
        uploadedAt: '2026-02-10T11:07:00Z',
      },
    ],
    simulationIds: ['sim-mirror-1'],
    activity: [
      {
        id: 'act-mirror-1',
        message: 'Proyecto archivado',
        timestamp: '2026-06-20T15:45:00Z',
        kind: 'archive',
      },
      {
        id: 'act-mirror-2',
        message: 'Simulación "Monte Carlo 500 corridas" completada',
        timestamp: '2026-06-18T09:00:00Z',
        kind: 'simulation',
      },
      {
        id: 'act-mirror-3',
        message: 'Proyecto creado',
        timestamp: '2026-02-10T11:00:00Z',
        kind: 'created',
      },
    ],
  },
]
