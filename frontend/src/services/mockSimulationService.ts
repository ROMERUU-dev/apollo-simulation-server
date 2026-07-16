import { createId } from '../utils/id'
import { delay } from '../utils/delay'
import type { NetlistTemplate, SimulationService } from './types'
import type { SimulationConfig } from '../types'

const templates: NetlistTemplate[] = [
  {
    id: 'template-rc-lowpass',
    name: 'Filtro RC pasa-bajas',
    description: 'Circuito de una etapa para pruebas rápidas de barrido de frecuencia.',
    content: `* Filtro RC pasa-bajas\nVIN in 0 AC 1\nR1 in out 1k\nC1 out 0 100n\n.AC DEC 20 1 1MEG\n.END\n`,
  },
  {
    id: 'template-cmos-inverter',
    name: 'Inversor CMOS',
    description: 'Inversor CMOS estándar con carga capacitiva, listo para análisis transitorio.',
    content: `* Inversor CMOS\nVDD vdd 0 DC 3.3\nVIN in 0 PULSE(0 3.3 0 1n 1n 10n 20n)\nMP out in vdd vdd PMOS_STD\nMN out in 0 0 NMOS_STD\nCLOAD out 0 5p\n.MODEL PMOS_STD PMOS (LEVEL=3 VTO=-0.75)\n.MODEL NMOS_STD NMOS (LEVEL=3 VTO=0.75)\n.TRAN 0.1n 200n\n.END\n`,
  },
  {
    id: 'template-diode-rectifier',
    name: 'Rectificador de media onda',
    description: 'Rectificador simple con diodo y carga resistiva para pruebas transitorias.',
    content: `* Rectificador de media onda\nVIN in 0 SIN(0 12 60)\nD1 in out DMOD\nRLOAD out 0 1k\n.MODEL DMOD D (IS=1e-14)\n.TRAN 0.1m 50m\n.END\n`,
  },
]

class MockSimulationService implements SimulationService {
  async listTemplates(): Promise<NetlistTemplate[]> {
    await delay(150)
    return templates
  }

  validateNetlist(content: string): { valid: boolean; message?: string } {
    const trimmed = content.trim()
    if (!trimmed) {
      return {
        valid: false,
        message: 'El netlist está vacío. Pega contenido, carga un archivo o elige una plantilla.',
      }
    }
    if (!/\.end\b/i.test(trimmed)) {
      return {
        valid: false,
        message: 'El netlist no contiene una directiva .END. Verifica el contenido.',
      }
    }
    return { valid: true }
  }

  async createConfig(input: {
    projectId: string
    name: string
    netlistId: string
    netlistContent: string
    modelFileIds: string[]
    simulatorId: SimulationConfig['simulatorId']
    parameters: SimulationConfig['parameters']
    execution: SimulationConfig['execution']
  }): Promise<SimulationConfig> {
    await delay(200)
    return {
      id: createId('sim'),
      createdAt: new Date().toISOString(),
      ...input,
    }
  }
}

export const simulationService: SimulationService = new MockSimulationService()
