import { LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      role="status"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', opacity: 0.75 }}
    >
      <LoaderCircle className="spin" size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
