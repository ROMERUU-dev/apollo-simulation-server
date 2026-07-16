import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 22,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 style={{ fontSize: 27, margin: '0 0 3px' }}>{title}</h1>
        {subtitle && <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  )
}
