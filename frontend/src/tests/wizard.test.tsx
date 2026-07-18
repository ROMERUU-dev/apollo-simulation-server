import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NewSimulationWizard } from '../features/simulations/wizard/NewSimulationWizard'

const VALID_NETLIST = 'VDD vdd 0 DC 5\nR1 vdd 0 1k\n.END\n'

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/simulations/new']}>
      <Routes>
        <Route path="/simulations/new" element={<NewSimulationWizard initialProjectId={null} />} />
        <Route path="/jobs/:jobId" element={<div>Vista de trabajo</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NewSimulationWizard', () => {
  it('blocks advancing past step 1 with an empty netlist', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText(/nombre de la simulación/i), 'Prueba')
    const nextButton = screen.getByRole('button', { name: /siguiente/i })
    expect(nextButton).toBeDisabled()
    expect(screen.getByText(/netlist está vacío/i)).toBeInTheDocument()
  })

  it('advances and returns while keeping entered data', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText(/nombre de la simulación/i), 'Barrido de prueba')
    await user.click(screen.getByLabelText(/contenido del netlist/i))
    await user.paste(VALID_NETLIST)

    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(await screen.findByRole('button', { name: /agregar archivos/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /atrás/i }))
    expect(await screen.findByLabelText(/nombre de la simulación/i)).toHaveValue(
      'Barrido de prueba',
    )
  })

  it('keeps simulator execution disabled', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText(/nombre de la simulación/i), 'Prueba')
    await user.click(screen.getByLabelText(/contenido del netlist/i))
    await user.paste(VALID_NETLIST)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))

    expect(await screen.findByRole('radiogroup', { name: /simulador/i })).toBeInTheDocument()
    const nextButton = screen.getByRole('button', { name: /siguiente/i })
    expect(nextButton).toBeDisabled()
    expect(await screen.findAllByText(/ejecución no habilitada/i)).toHaveLength(2)
  })

  it('shows the computed number of combinations on the parameters step', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText(/nombre de la simulación/i), 'Prueba')
    await user.click(screen.getByLabelText(/contenido del netlist/i))
    await user.paste(VALID_NETLIST)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(await screen.findAllByText(/ejecución no habilitada/i)).toHaveLength(2)
  })

  it('does not create a simulated job', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText(/nombre de la simulación/i), 'Prueba de trabajo')
    await user.click(screen.getByLabelText(/contenido del netlist/i))
    await user.paste(VALID_NETLIST)
    await user.click(screen.getByRole('button', { name: /siguiente/i })) // -> files
    await user.click(screen.getByRole('button', { name: /siguiente/i })) // -> simulator
    expect(await screen.findAllByText(/ejecución no habilitada/i)).toHaveLength(2)
    expect(screen.queryByText('Vista de trabajo')).not.toBeInTheDocument()
  })
})
