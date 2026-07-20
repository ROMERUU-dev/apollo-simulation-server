import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../app/App'

describe('primary navigation', () => {
  it('navigates between sections via the sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Proyectos/i }))
    expect(await screen.findByRole('heading', { name: 'Proyectos', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Trabajos/i }))
    expect(await screen.findByRole('heading', { name: 'Trabajos', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Resultados/i }))
    expect(await screen.findByRole('heading', { name: 'Resultados', level: 1 })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    window.history.pushState({}, '', '/unknown-route')
    render(<App />)
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument()
  })
})
