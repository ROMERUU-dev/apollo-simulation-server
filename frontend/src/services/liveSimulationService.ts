import type { ExecutionConfig, ParameterDefinition, SimulationConfig, SimulatorId } from '../types'
import type { NetlistTemplate, SimulationService } from './types'

function unavailable(): never {
  throw new Error('La ejecución real aún no está habilitada.')
}

class LiveSimulationService implements SimulationService {
  async listTemplates(): Promise<NetlistTemplate[]> {
    return []
  }

  validateNetlist(content: string): { valid: boolean; message?: string } {
    const trimmed = content.trim()
    if (!trimmed) {
      return {
        valid: false,
        message: 'El netlist está vacío. Pega contenido cuando la ejecución esté habilitada.',
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

  async createConfig(_input: {
    projectId: string
    name: string
    netlistId: string
    netlistContent: string
    modelFileIds: string[]
    simulatorId: SimulatorId
    parameters: ParameterDefinition[]
    execution: ExecutionConfig
  }): Promise<SimulationConfig> {
    unavailable()
  }
}

export const simulationService: SimulationService = new LiveSimulationService()
