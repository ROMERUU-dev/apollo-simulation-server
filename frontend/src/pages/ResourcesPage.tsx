import { PageHeader } from '../components/layout/PageHeader'
import { useSession } from '../session/useSession'

export default function ResourcesPage() {
  const { health } = useSession()

  return (
    <div>
      <PageHeader
        title="Recursos del servidor"
        subtitle="Telemetría de recursos aún no publicada por la API"
      />

      <section className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Estado real disponible</h2>
        <p style={{ marginTop: 0 }}>
          La API está {health?.status === 'ok' ? 'conectada' : 'no disponible'} y el envío de
          trabajos está{' '}
          {health?.features.custom_netlists === 'available' ? 'disponible' : 'aún no habilitado'}.
        </p>
        <p style={{ marginBottom: 0 }}>
          CPU, RAM, almacenamiento, hostname, modelo de servidor y versiones de simuladores se
          mostrarán cuando exista una API de telemetría real.
        </p>
      </section>
    </div>
  )
}
