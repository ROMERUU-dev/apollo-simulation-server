interface ResourceMeterProps {
  label: string
  percent: number
  detail: string
}

export function ResourceMeter({ label, percent, detail }: ResourceMeterProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="card">
      <i className="card-corner tl" aria-hidden="true" />
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          opacity: 0.55,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>
        {Math.round(clamped)}%
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ height: 5, background: 'var(--color-neutral-200)', marginTop: 9 }}
      >
        <div
          style={{ height: '100%', width: `${clamped}%`, background: 'var(--color-accent-600)' }}
        />
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6 }}>{detail}</div>
    </div>
  )
}
