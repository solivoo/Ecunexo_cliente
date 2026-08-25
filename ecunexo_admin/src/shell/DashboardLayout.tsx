import { useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { SessionBootstrap } from '@/features/auth/SessionBootstrap'
import { navigationToMenuConfig } from '@/features/navigation/mapNavigationToMenu'
import { getPageTitle } from '@/lib/getPageTitle'
import { clearCredentials, selectPermissions, selectVisibleNavigation } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { AppSidebar } from '@/shell/AppSidebar'
import { AppShellUserMenu } from '@/shell/components/AppShellUserMenu'
import './appShell.css'

export function DashboardLayout() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const dispatch = useAppDispatch()
  const navigation = useAppSelector(selectVisibleNavigation)
  const permissions = useAppSelector(selectPermissions)
  const [collapsed, setCollapsed] = useState(false)
  const menu = useMemo(() => navigationToMenuConfig(navigation, permissions), [navigation, permissions])
  const pageTitle = getPageTitle(pathname, menu, 'EcuNexo', search)

  const logout = useCallback(() => {
    dispatch(clearCredentials())
    void navigate('/', { replace: true })
  }, [dispatch, navigate])

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
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__header">
          <div className="app-shell__header-start">
            <span className="app-shell__header-title">{pageTitle}</span>
          </div>
          <div className="app-shell__header-end">
            <ThemeToggleButton variant="icon" />
            <AppShellUserMenu onLogout={logout} />
          </div>
        </header>
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
