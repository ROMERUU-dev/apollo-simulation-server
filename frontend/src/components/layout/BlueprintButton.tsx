import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BlueprintButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  children: ReactNode
}

/** Primary call-to-action styled after the prototype's cornered "blueprint" button. */
export function BlueprintButton({ icon, children, style, ...rest }: BlueprintButtonProps) {
  return (
    <button
      type="button"
      className="blueprint"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-accent)',
        color: 'var(--color-bg)',
        border: '1px solid var(--color-accent)',
        padding: '10px 18px',
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      <i className="card-corner tl" aria-hidden="true" />
      <i className="card-corner tr" aria-hidden="true" />
      <i className="card-corner bl" aria-hidden="true" />
      <i className="card-corner br" aria-hidden="true" />
      {icon}
      {children}
    </button>
  )
}
