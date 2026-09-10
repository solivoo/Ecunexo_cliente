import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { SessionBootstrap } from '@/features/auth/SessionBootstrap'
import { navigationToMenuConfig } from '@/features/navigation/mapNavigationToMenu'
import { getPageTitle } from '@/lib/getPageTitle'
import { clearCredentials, selectPermissions, selectVisibleNavigation } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { AppSidebar } from '@/shell/AppSidebar'
import { AppShellUserMenu } from '@/shell/components/AppShellUserMenu'
import { AboutAppModal } from '@/components/about/AboutAppModal'
import {
  CommandPaletteModal,
  CommandPaletteTrigger,
  useCommandPaletteItems,
} from '@/components/command-palette'
import { APP_VERSION_INFO } from '@/config/appVersion'
import './appShell.css'

export function DashboardLayout() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const dispatch = useAppDispatch()
  const navigation = useAppSelector(selectVisibleNavigation)
  const permissions = useAppSelector(selectPermissions)
  const [collapsed, setCollapsed] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const menu = useMemo(() => navigationToMenuConfig(navigation, permissions), [navigation, permissions])
  const pageTitle = getPageTitle(pathname, menu, 'EcuNexo', search)

  const logout = useCallback(() => {
    dispatch(clearCredentials())
    void navigate('/', { replace: true })
  }, [dispatch, navigate])

  const commandItems = useCommandPaletteItems({
    onOpenAbout: () => setAboutOpen(true),
    onLogout: logout,
  })

  // Listener global para Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <SessionBootstrap />
      <aside className="app-shell__sidebar" aria-label="Navegación principal">
        <div className="app-shell__nav">
          <AppSidebar
            nodes={navigation}
            permissions={permissions}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
          />
        </div>
        <div className="app-shell__sidebar-footer">
          <button
            type="button"
            className="app-shell__version-btn"
            onClick={() => setAboutOpen(true)}
            title={`EcuNexo v${APP_VERSION_INFO.version} (${APP_VERSION_INFO.gitCommit}) · Clic para ver detalles`}
          >
            <span className="app-shell__version-tag">v{APP_VERSION_INFO.version}</span>
            {!collapsed && (
              <span className="app-shell__version-commit">{APP_VERSION_INFO.gitCommit}</span>
            )}
          </button>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__header">
          <div className="app-shell__header-start">
            <span className="app-shell__header-title">{pageTitle}</span>
          </div>
          <div className="app-shell__header-center">
            <CommandPaletteTrigger onClick={() => setCommandOpen(true)} />
          </div>
          <div className="app-shell__header-end">
            <ThemeToggleButton variant="icon" />
            <AppShellUserMenu onLogout={logout} onOpenAbout={() => setAboutOpen(true)} />
          </div>
        </header>
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>

      <AboutAppModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CommandPaletteModal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        items={commandItems}
      />
    </div>
  )
}
