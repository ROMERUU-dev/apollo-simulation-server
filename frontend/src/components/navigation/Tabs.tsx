import { useState, type ReactNode } from 'react'

export interface TabDef {
  id: string
  label: string
  content: ReactNode
}

export function Tabs({ tabs, initialTabId }: { tabs: TabDef[]; initialTabId?: string }) {
  const [activeId, setActiveId] = useState(initialTabId ?? tabs[0]?.id)
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de resultados"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--color-divider)',
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active?.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveId(tab.id)}
            style={{
              padding: '9px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                tab.id === active?.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab.id === active?.id ? 'var(--color-accent-700)' : 'inherit',
              fontWeight: tab.id === active?.id ? 600 : 500,
              cursor: 'pointer',
              fontSize: 13.5,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active && (
        <div role="tabpanel" id={`tabpanel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
          {active.content}
        </div>
      )}
    </div>
  )
}
