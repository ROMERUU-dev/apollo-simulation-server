import { Link } from 'react-router-dom'
import { EmptyState } from '../components/feedback/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Página no encontrada"
      description="La ruta solicitada no existe."
      action={<Link to="/">Volver al inicio</Link>}
    />
  )
}
