import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { CustomNetlistForm } from '../features/simulations/custom/CustomNetlistForm'
import { Sky130Form } from '../features/simulations/sky130/Sky130Form'

type SimulationMode = 'custom' | 'sky130'

const MODES: { id: SimulationMode; label: string }[] = [
  { id: 'custom', label: 'Netlist Xyce personalizada' },
  { id: 'sky130', label: 'Oscilador SKY130' },
]

export default function NewSimulationPage() {
  const [mode, setMode] = useState<SimulationMode>('custom')
  const title = mode === 'custom' ? 'Netlist personalizada' : 'Oscilador SKY130'
  const subtitle =
    mode === 'custom'
      ? 'Subconjunto controlado de Xyce 7.10'
      : 'Plantilla administrada por el servidor · sky130_fd_pr__nfet_g5v0d10v5 · corner tt'

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="fixed-job-field" role="radiogroup" aria-label="Tipo de simulación">
        <div className="fixed-job-field-row">
          {MODES.map((option) => (
            <label key={option.id} className="fixed-job-radio-option">
              <input
                type="radio"
                name="simulation-mode"
                value={option.id}
                checked={mode === option.id}
                onChange={() => setMode(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      {mode === 'custom' ? <CustomNetlistForm /> : <Sky130Form />}
    </div>
  )
}
