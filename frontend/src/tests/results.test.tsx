import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultDetailPage from '../pages/ResultDetailPage'

function renderResult(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/results/${id}`]}>
      <Routes>
        <Route path="/results/:simulationId" element={<ResultDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResultDetailPage', () => {
  it('renders the summary tab by default', async () => {
    renderResult('result-cmos-amp')

    expect(
      await screen.findByRole('heading', { name: 'Respuesta en frecuencia', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Corridas totales')).toBeInTheDocument()
    expect(screen.getByText('Amplificador CMOS')).toBeInTheDocument()
  })

  it('shows generated artifacts under the files tab', async () => {
    const user = userEvent.setup()
    renderResult('result-cmos-amp')

    await screen.findByRole('heading', { name: 'Respuesta en frecuencia', level: 1 })
    await user.click(screen.getByRole('tab', { name: 'Archivos' }))

    expect(await screen.findByText('cmos_two_stage.raw')).toBeInTheDocument()
  })

  it('shows an error state for an unknown result id', async () => {
    renderResult('does-not-exist')
    expect(await screen.findByText(/resultado no encontrado/i)).toBeInTheDocument()
  })
})
