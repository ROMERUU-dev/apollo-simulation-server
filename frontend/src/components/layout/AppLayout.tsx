import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  CirclePlus,
  ClipboardList,
  FolderKanban,
  Home,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Activity,
} from 'lucide-react'
import { useAdminMonitoringAccess } from '../../hooks/useAdminMonitoringAccess'
import { useJobs } from '../../hooks/useJobs'
import { useSession } from '../../session/useSession'
import { ThemeToggle } from './ThemeToggle'
import styles from './AppLayout.module.css'

interface NavItemDef {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  badge?: number
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { jobs } = useJobs()
  const { identity, health } = useSession()
  const location = useLocation()
  const activeJobsCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  const displayName = identity?.name?.trim() || identity?.email || 'Sesión no disponible'
  const backendConnected = health?.status === 'ok'
  const monitoringAllowed = useAdminMonitoringAccess()

  const navItems: NavItemDef[] = [
    { to: '/', label: 'Inicio', icon: Home, end: true },
    { to: '/projects', label: 'Proyectos', icon: FolderKanban },
    { to: '/simulations/new', label: 'Nueva simulación', icon: CirclePlus },
    { to: '/jobs', label: 'Trabajos', icon: ClipboardList, badge: activeJobsCount },
    { to: '/results', label: 'Resultados', icon: LineChart },
    { to: '/settings', label: 'Configuración', icon: Settings },
    ...(monitoringAllowed
      ? [{ to: '/admin/monitoring', label: 'Monitorización', icon: Activity }]
      : []),
  ]

  return (
    <div className={styles.shell} data-testid="app-shell">
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.brand}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#93bdd4"
            strokeWidth="1.5"
            aria-hidden="true"
            style={{ flex: 'none' }}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          {!collapsed && (
            <div className={styles.brandText}>
              CimaSim
              <span className={styles.brandSubtitle}>Xyce · ejecución aislada</span>
            </div>
          )}
        </div>

        <nav className={styles.nav} aria-label="Navegación principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              aria-current={
                location.pathname === item.to ||
                (!item.end && location.pathname.startsWith(item.to))
                  ? 'page'
                  : undefined
              }
            >
              <item.icon size={17} aria-hidden="true" style={{ flex: 'none' }} />
              {!collapsed && (
                <>
                  <span className={styles.navLabel}>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className={styles.navBadge} aria-label={`${item.badge} trabajos activos`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          {!collapsed && (
            <>
              <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.82, marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>{displayName}</div>
                {identity?.email && <div>{identity.email}</div>}
                <div>{backendConnected ? 'API conectada' : 'API no disponible'}</div>
                <div>Sesión protegida por Cloudflare Access</div>
              </div>
              <ThemeToggle />
            </>
          )}
          <button
            type="button"
            className={styles.footerButton}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {collapsed ? (
              <PanelLeftOpen size={15} aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose size={15} aria-hidden="true" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <main className={styles.main} id="main-content">
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  )
}
