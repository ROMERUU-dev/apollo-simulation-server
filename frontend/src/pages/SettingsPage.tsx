import { PageHeader } from '../components/layout/PageHeader'
import { useThemeStore } from '../hooks/useThemeStore'
import { useSession } from '../session/useSession'

export default function SettingsPage() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { identity, health } = useSession()
  const displayName = identity?.name?.trim() || null
  const role = identity?.roles.includes('user') ? 'Usuario' : 'Sin rol asignado'

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

      <section className="card" style={{ maxWidth: 640 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Mi sesión</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, margin: 0 }}>
          {displayName && (
            <>
              <dt>Nombre</dt>
              <dd style={{ margin: 0 }}>{displayName}</dd>
            </>
          )}
          <dt>Email</dt>
          <dd style={{ margin: 0 }}>{identity?.email ?? 'No disponible'}</dd>
          <dt>Rol</dt>
          <dd style={{ margin: 0 }}>{role}</dd>
          <dt>Protección</dt>
          <dd style={{ margin: 0 }}>Sesión protegida por Cloudflare Access</dd>
          <dt>Backend</dt>
          <dd style={{ margin: 0 }}>{health?.status === 'ok' ? 'Conectado' : 'No disponible'}</dd>
          <dt>Envío de trabajos</dt>
          <dd style={{ margin: 0 }}>
            {health?.features.job_submission === 'not_available'
              ? 'Aún no habilitado'
              : 'Disponible'}
          </dd>
          <dt>Límites</dt>
          <dd style={{ margin: 0 }}>
            {identity?.limits && Object.keys(identity.limits).length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {Object.entries(identity.limits).map(([key, value]) => (
                  <li key={key}>
                    {key.replaceAll('_', ' ')}: {String(value)}
                  </li>
                ))}
              </ul>
            ) : (
              'No informados por la API'
            )}
          </dd>
        </dl>
      </section>
    </div>
  )
}
