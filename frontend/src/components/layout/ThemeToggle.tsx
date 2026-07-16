import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../../hooks/useThemeStore'
import styles from './AppLayout.module.css'

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={styles.footerButton}
      onClick={toggleTheme}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
