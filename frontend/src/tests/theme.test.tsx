import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppLayout } from '../components/layout/AppLayout'
import { MemoryRouter } from 'react-router-dom'
import { useThemeStore } from '../hooks/useThemeStore'
import { SessionProvider } from '../session/SessionContext'

describe('theme toggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'light')
    useThemeStore.setState({ theme: 'light' })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('switches the theme attribute and persists the preference', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionProvider>
          <AppLayout>
            <div>content</div>
          </AppLayout>
        </SessionProvider>
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /modo oscuro/i })
    await user.click(toggle)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('apollo-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /modo claro/i })).toBeInTheDocument()
  })
})
