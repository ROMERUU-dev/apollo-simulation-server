import { WifiOff } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'No se pudo conectar con el servidor',
  description = 'Verifica la conexión o intenta nuevamente en unos segundos.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '48px 24px',
        border: '1px solid var(--status-bad)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--status-bad-bg)',
      }}
    >
      <WifiOff size={28} aria-hidden="true" color="var(--status-bad)" />
      <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, margin: 0 }}>
        {title}
      </p>
      <p style={{ margin: 0, opacity: 0.75, maxWidth: 420 }}>{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="card" style={{ cursor: 'pointer' }}>
          Reintentar
        </button>
      )}
    </div>
  )
}
