export function JobProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 5,
        background: 'var(--color-neutral-200)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          background: 'var(--color-accent-600)',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}
