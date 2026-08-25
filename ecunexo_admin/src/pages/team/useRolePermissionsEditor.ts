import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import { isPermissionAllowedForModules } from '@/lib/modulePermissionFilter'
import { moduleKey, uniqueModuleSelectOptions } from '@/lib/moduleLabels'
import type { RolePermissionRow } from '@/pages/team/RolePermissionsGrid'
import {
  getTenantRole,
  listPermissions,
  replaceRolePermissions,
} from '@/services/identityApi'
import {
  selectEnabledModules,
  selectModuleEntitlements,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantRoleDto, PermissionListItemDto } from '@/types/identityApi'

export type AssignmentFilter = 'all' | 'assigned' | 'unassigned'

export function useRolePermissionsEditor(tenantId: string | null, roleId: string) {
  const toast = useToast()
  const enabledModules = useAppSelector(selectEnabledModules)
  const moduleEntitlements = useAppSelector(selectModuleEntitlements)
  const [role, setRole] = useState<GetTenantRoleDto | null>(null)
  const [perms, setPerms] = useState<PermissionListItemDto[]>([])
  const [baselineIds, setBaselineIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [moduleFilter, setModuleFilter] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId || !roleId) return
    setLoading(true)
    try {
      const [r, all] = await Promise.all([getTenantRole(tenantId, roleId), listPermissions()])
      const active = all.filter((p) => p.status === 0)
      const assignable = active.filter((p) =>
        isPermissionAllowedForModules(p.code, enabledModules, moduleEntitlements)
      )
      // Mantén en la grilla los ya asignados aunque el módulo saliera de la licencia.
      const assignedExtra = all.filter(
        (p) => r.permissionIds.includes(p.id) && !assignable.some((a) => a.id === p.id)
      )
      const catalog = [...assignable, ...assignedExtra]
      setRole(r)
      setPerms(catalog)
      setBaselineIds([...r.permissionIds])
      setSelectedIds([...r.permissionIds])
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar los permisos del rol.'))
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [enabledModules, moduleEntitlements, roleId, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const displayPerms = useMemo(() => perms, [perms])

  const moduleOptions = useMemo(
    () => [
      { value: '', label: 'Todos los módulos' },
      ...uniqueModuleSelectOptions(displayPerms.map((p) => p.module)),
    ],
    [displayPerms]
  )

  const allRows = useMemo((): RolePermissionRow[] => {
    const selected = new Set(selectedIds)
    return displayPerms
      .map((p) => ({
        id: p.id,
        code: p.code,
        displayName: p.displayName,
        description: p.description,
        module: p.module,
        assigned: selected.has(p.id),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'es'))
  }, [displayPerms, selectedIds])

  const filteredRows = useMemo(() => {
    const marked = new Set(selectedIds)
    return allRows.filter((row) => {
      if (moduleFilter && moduleKey(row.module) !== moduleFilter) return false
      if (assignmentFilter === 'assigned' && !marked.has(row.id)) return false
      if (assignmentFilter === 'unassigned' && marked.has(row.id)) return false
      return true
    })
  }, [allRows, assignmentFilter, moduleFilter, selectedIds])

  const dirty = useMemo(() => {
    const a = new Set(baselineIds)
    const b = new Set(selectedIds)
    if (a.size !== b.size) return true
    for (const id of a) {
      if (!b.has(id)) return true
    }
    return false
  }, [baselineIds, selectedIds])

  const handleSelectionChange = useCallback(
    (selectedRows: RolePermissionRow[]) => {
      const visibleIds = new Set(filteredRows.map((r) => r.id))
      const next = new Set(selectedIds)
      for (const id of visibleIds) next.delete(id)
      for (const row of selectedRows) next.add(row.id)
      setSelectedIds([...next])
    },
    [filteredRows, selectedIds]
  )

  const onSave = useCallback(async () => {
    if (!tenantId || !role) return
    setBusy(true)
    setError(null)
    try {
      const known = new Set(perms.map((p) => p.id))
      const permissionIds = selectedIds.filter((id) => known.has(id))
      const result = await replaceRolePermissions(tenantId, roleId, permissionIds)
      toast.show({
        title: 'Permisos actualizados',
        message: `+${result.granted} otorgados · −${result.revoked} quitados.`,
        variant: 'success',
      })
      await load()
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron guardar los permisos del rol.')
      setError(message)
      toast.show({ title: 'Error', message, variant: 'error' })
      await load()
    } finally {
      setBusy(false)
    }
  }, [load, perms, role, roleId, selectedIds, tenantId, toast])

  return {
    role,
    perms: displayPerms,
    selectedIds,
    moduleFilter,
    setModuleFilter,
    assignmentFilter,
    setAssignmentFilter,
    moduleOptions,
    filteredRows,
    dirty,
    loading,
    busy,
    error,
    handleSelectionChange,
    onSave,
  }
}
