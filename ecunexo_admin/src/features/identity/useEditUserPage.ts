import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import { useEditUserPassword } from '@/features/identity/useEditUserPassword'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  assignUserRole,
  getTenantUser,
  listTenantDepartments,
  listTenantRoles,
  unassignUserRole,
  updateTenantUser,
} from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { DepartmentListItemDto, GetTenantUserDto, RoleListItemDto } from '@/types/identityApi'

export function useEditUserPage() {
  const { userId = '' } = useParams<{ userId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canUpdate = useHasPermission('identity.users.update')
  const canReadDepartments = useHasPermission('identity.departments.read')
  const canManageRoles = useHasPermission('identity.roles.manage')

  const [user, setUser] = useState<GetTenantUserDto | null>(null)
  const [departments, setDepartments] = useState<DepartmentListItemDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const password = useEditUserPassword({ tenantId, userId, user, onError: setError })
  const detailPath = `/equipo/usuarios/${userId}`
  const formLocked = busy || password.passwordBusy

  const load = useCallback(async () => {
    if (!tenantId || !userId) return
    setLoading(true)
    try {
      const [u, depts, roleList] = await Promise.all([
        getTenantUser(tenantId, userId),
        canReadDepartments
          ? listTenantDepartments(tenantId)
          : Promise.resolve([] as DepartmentListItemDto[]),
        canManageRoles ? listTenantRoles(tenantId) : Promise.resolve([] as RoleListItemDto[]),
      ])
      setUser(u)
      setDepartments(depts)
      setRoles(roleList)
      setEmail(u.email)
      setName(u.name)
      setDepartmentId(u.departmentId ?? '')
      setRoleId(u.roleIds[0] ?? '')
      setPhone(u.phone ?? '')
      setJobTitle(u.jobTitle ?? '')
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el usuario.'))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [canManageRoles, canReadDepartments, tenantId, userId])

  useEffect(() => {
    void load()
  }, [load])

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  )
  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles])
  const actionItems = useMemo<PageActionItem[]>(
    () => [
      { id: 'detail', label: 'Ficha del usuario', icon: 'users', route: detailPath, disabled: false },
      { id: 'list', label: 'Listado de usuarios', icon: 'users', route: '/equipo/usuarios', disabled: false },
      {
        id: 'departments',
        label: 'Departamentos',
        icon: 'building-2',
        route: '/equipo/departamentos',
        disabled: false,
      },
    ],
    [detailPath]
  )

  const onSubmitProfile = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !user) return
      setBusy(true)
      setError(null)
      try {
        if (!name.trim()) throw new Error('El nombre es obligatorio.')
        const nextEmail = email.trim()
        if (!nextEmail) throw new Error('El correo es obligatorio.')
        if (!nextEmail.includes('@')) throw new Error('El correo no tiene un formato válido.')
        await updateTenantUser(tenantId, userId, {
          name: name.trim(),
          email: user.isCompanyOwner ? undefined : nextEmail,
          departmentId: departmentId || null,
          phone: phone.trim() || null,
          jobTitle: jobTitle.trim() || null,
        })
        if (canManageRoles && !user.isCompanyOwner) {
          if (!roleId) {
            throw new Error(
              'Selecciona un rol. Dejarlo vacío quitaría todos los roles y bloquea la administración del tenant.'
            )
          }
          const current = new Set(user.roleIds)
          for (const rid of current) {
            if (rid !== roleId) await unassignUserRole(tenantId, userId, rid)
          }
          if (!current.has(roleId)) await assignUserRole(tenantId, userId, roleId)
        }
        toast.show({
          title: 'Usuario actualizado',
          message: `«${name.trim()}» quedó guardado.`,
          variant: 'success',
        })
        void navigate(detailPath, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo actualizar el usuario.')
        setError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      canManageRoles,
      departmentId,
      detailPath,
      email,
      jobTitle,
      name,
      navigate,
      phone,
      roleId,
      tenantId,
      toast,
      user,
      userId,
    ]
  )

  return {
    actionItems,
    busy,
    canManageRoles,
    canReadDepartments,
    canUpdate,
    departmentId,
    departmentOptions,
    departments,
    detailPath,
    email,
    error,
    formLocked,
    jobTitle,
    loading,
    name,
    navigate,
    onSubmitProfile,
    phone,
    roleId,
    roleOptions,
    roles,
    setDepartmentId,
    setEmail,
    setJobTitle,
    setName,
    setPhone,
    setRoleId,
    user,
    ...password,
  }
}
