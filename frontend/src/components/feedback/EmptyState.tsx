import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '48px 24px',
        border: '1px dashed var(--color-divider)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-text)',
      }}
    >
      <Icon size={28} aria-hidden="true" style={{ opacity: 0.5 }} />
      <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, margin: 0 }}>
        {title}
      </p>
      {description && <p style={{ margin: 0, opacity: 0.65, maxWidth: 420 }}>{description}</p>}
      {action}
    </div>
  )
}
