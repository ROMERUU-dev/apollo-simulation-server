import { PageHeader } from '../components/layout/PageHeader'
import { useThemeStore } from '../hooks/useThemeStore'

export default function SettingsPage() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Preferencias de la aplicación" />

      <section className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Apariencia</h2>
        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: 16 }}>
          <legend className="visually-hidden">Tema</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="radio"
              name="theme"
              checked={theme === 'light'}
              onChange={() => setTheme('light')}
            />
            Claro
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="radio"
              name="theme"
              checked={theme === 'dark'}
              onChange={() => setTheme('dark')}
            />
            Oscuro
          </label>
        </fieldset>
      </section>

      <section className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Conexión con el backend</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
          Esta versión del frontend utiliza datos simulados en memoria. Cuando el backend de FastAPI
          esté disponible, los servicios en <code>src/services</code> se reemplazarán por
          implementaciones que llamen a la API real, sin cambios en las páginas.
        </p>
      </section>
    </div>
  )
}
