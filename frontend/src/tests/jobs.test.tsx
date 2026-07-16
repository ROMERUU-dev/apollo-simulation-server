import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import JobsPage from '../pages/JobsPage'

describe('JobsPage', () => {
  it('cancels a queued job from the actions menu', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <JobsPage />
      </MemoryRouter>,
    )

    const row = (await screen.findByText('Análisis de mismatch en espejo de polarización')).closest(
      'tr',
    ) as HTMLElement
    expect(within(row!).getByText('En cola')).toBeInTheDocument()

    await user.click(within(row!).getByRole('button', { name: /acciones para/i }))
    await user.click(await screen.findByRole('menuitem', { name: /cancelar/i }))

    expect(await within(row!).findByText('Cancelado')).toBeInTheDocument()
  })

  it('filters jobs by status', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <JobsPage />
      </MemoryRouter>,
    )

    await screen.findByText('Barrido CLOAD/RLOAD')
    await user.selectOptions(screen.getByDisplayValue('Todos los estados'), 'failed')

    expect(screen.queryByText('Barrido CLOAD/RLOAD')).not.toBeInTheDocument()
    expect(await screen.findByText('Curvas Id-Vgs por esquina')).toBeInTheDocument()
  })
})
