import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProjectsPage from '../pages/ProjectsPage'

describe('ProjectsPage', () => {
  it('creates a new project and lists it', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )

    await screen.findByText('Oscilador térmico MOSFET')

    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Convertidor buck síncrono')
    await user.click(within(dialog).getByRole('button', { name: /crear proyecto/i }))

    expect(await screen.findByText('Convertidor buck síncrono')).toBeInTheDocument()
  })

  it('requires a name before creating a project', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )

    await screen.findByText('Oscilador térmico MOSFET')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /crear proyecto/i }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent(/obligatorio/i)
  })

  it('asks for confirmation before deleting a project', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )

    const card = (await screen.findByText('Amplificador CMOS')).closest('div.card') as HTMLElement
    await user.click(within(card!).getByRole('button', { name: /acciones para/i }))
    await user.click(await screen.findByRole('menuitem', { name: /eliminar/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/eliminar proyecto/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Amplificador CMOS')).toBeInTheDocument()

    await user.click(within(card!).getByRole('button', { name: /acciones para/i }))
    await user.click(await screen.findByRole('menuitem', { name: /eliminar/i }))
    const confirmDialog = await screen.findByRole('dialog')
    await user.click(within(confirmDialog).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => {
      expect(screen.queryByText('Amplificador CMOS')).not.toBeInTheDocument()
    })
  })
})
