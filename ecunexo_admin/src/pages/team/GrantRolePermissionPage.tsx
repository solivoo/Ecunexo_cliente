import { Navigate, useParams } from 'react-router-dom'

/** Redirect legacy route → gestionar permisos del rol. */
export function GrantRolePermissionPage() {
  const { roleId = '' } = useParams<{ roleId: string }>()
  return <Navigate to={`/equipo/roles/${roleId}/permisos`} replace />
}
