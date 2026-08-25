import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from 'glubox'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { navigationToMenuConfig } from '@/features/navigation/mapNavigationToMenu'
import { TenantSidebarBrand } from '@/shell/TenantSidebarBrand'
import type { NavigationNode } from '@/types/navigation'

const SIDEBAR_WIDTH_EXPANDED = 260
const SIDEBAR_WIDTH_COLLAPSED = 72

export interface AppSidebarProps {
  readonly nodes: NavigationNode[]
  readonly permissions: string[]
  readonly collapsed: boolean
  readonly onCollapsedChange: (collapsed: boolean) => void
}

export function AppSidebar({
  nodes,
  permissions,
  collapsed,
  onCollapsedChange,
}: AppSidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const menu = useMemo(() => navigationToMenuConfig(nodes, permissions), [nodes, permissions])
  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <Sidebar
      menu={menu}
      userPermissions={permissions}
      brand={TenantSidebarBrand}
      collapsed={collapsed}
      activePath={pathname}
      width={width}
      renderIcon={renderSidebarIcon}
      onCollapsedChange={onCollapsedChange}
      onNavigate={navigate}
      collapseOthersOnSelect
    />
  )
}
