import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Shield, UserRound } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { assignUserRole, createTenantUser, listTenantDepartments, listTenantRoles } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { DepartmentListItemDto, RoleListItemDto } from '@/types/identityApi'

export function CreateUserPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('identity.users.create')
  const canAssignRole = useHasPermission('identity.roles.manage')
  const canReadDepartments = useHasPermission('identity.departments.read')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [departments, setDepartments] = useState<DepartmentListItemDto[]>([])
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  useEffect(() => {
    if (!tenantId || !canAssignRole) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listTenantRoles(tenantId)
        if (!cancelled) {
          setRoles(list)
          setRolesError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setRoles([])
          setRolesError(readApiError(err, 'No se pudieron cargar los roles.'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAssignRole, tenantId])

  useEffect(() => {
    if (!tenantId || !canReadDepartments) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listTenantDepartments(tenantId)
        if (!cancelled) {
          setDepartments(list)
          setDepartmentsError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setDepartments([])
          setDepartmentsError(readApiError(err, 'No se pudieron cargar los departamentos.'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canReadDepartments, tenantId])

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles]
  )

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  )

  const goToList = useCallback(() => {
    void navigate('/equipo/usuarios')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de usuarios',
        icon: 'users',
        route: '/equipo/usuarios',
        disabled: false,
      },
      {
        id: 'roles',
        label: 'Roles',
        icon: 'shield',
        route: '/equipo/roles',
        disabled: false,
      },
      {
        id: 'departments',
        label: 'Departamentos',
        icon: 'building-2',
        route: '/equipo/departamentos',
        disabled: false,
      },
    ],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!email.trim()) throw new Error('El correo es obligatorio.')
        if (!name.trim()) throw new Error('El nombre es obligatorio.')
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        if (password !== passwordConfirm) throw new Error('Las contraseñas no coinciden.')

        const res = await createTenantUser(tenantId, {
          email: email.trim(),
          name: name.trim(),
          password,
          departmentId: departmentId || null,
          phone: phone.trim() || null,
          jobTitle: jobTitle.trim() || null,
        })

        if (canAssignRole && roleId) {
          try {
            await assignUserRole(tenantId, res.userId, roleId)
            const roleName = roles.find((r) => r.id === roleId)?.name ?? 'Rol'
            toast.show({
              title: 'Usuario creado',
              message: `«${name.trim()}» quedó con el rol «${roleName}» y ya puede iniciar sesión.`,
              variant: 'success',
            })
          } catch (roleErr: unknown) {
            toast.show({
              title: 'Usuario creado sin rol',
              message: readApiError(
                roleErr,
                'El usuario se creó, pero no se pudo asignar el rol. Hazlo desde su ficha.'
              ),
              variant: 'warning',
            })
          }
        } else {
          toast.show({
            title: 'Usuario creado',
            message: `«${name.trim()}» ya puede iniciar sesión.${canAssignRole ? '' : ' Asigna un rol desde su ficha.'}`,
            variant: 'success',
          })
        }

        void navigate(`/equipo/usuarios/${res.userId}`, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear el usuario.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      canAssignRole,
      departmentId,
      email,
      jobTitle,
      name,
      navigate,
      password,
      passwordConfirm,
      phone,
      roleId,
      roles,
      tenantId,
      toast,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo usuario" lead="Alta de una persona en la empresa.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres el permiso identity.users.create para crear usuarios.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nuevo usuario" lead="Alta de una persona en la empresa.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo Usuario"
          subtitle="Completa la ficha de contacto, área organizacional y —si tienes permisos— asigna el rol inicial del colaborador."
          badge={
            <StatusBadge tone="primary" withDot>
              Alta de Cuenta
            </StatusBadge>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={goToList}
              >
                Volver a Usuarios
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
              />
            </>
          }
        />

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserRound size={18} strokeWidth={1.75} aria-hidden /> Credenciales y Datos Personales
              </span>
            }
            subtitle="Correo, nombre y contraseña inicial (mínimo 8 caracteres) requeridos para iniciar sesión."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-email"
                  label="Correo"
                  labelPosition="outlined"
                  variant="outline"
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-name"
                  label="Nombre"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-password"
                  label="Contraseña inicial"
                  labelPosition="outlined"
                  variant="outline"
                  type="password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-password-confirm"
                  label="Confirmar contraseña"
                  labelPosition="outlined"
                  variant="outline"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPasswordConfirm(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                  error={passwordConfirm.length > 0 && password !== passwordConfirm}
                  errorMessage={
                    passwordConfirm.length > 0 && password !== passwordConfirm
                      ? 'No coincide con la contraseña'
                      : undefined
                  }
                />
              </div>
              <div className="ecu-companies-form__field">
                {canReadDepartments ? (
                  <>
                    {departmentsError ? (
                      <p className="welcome-onboarding__error" role="alert">
                        {departmentsError}
                      </p>
                    ) : null}
                    {departments.length === 0 && !departmentsError ? (
                      <p className="app-shell__muted">
                        No hay departamentos. Crea uno en Equipo → Departamentos.
                      </p>
                    ) : (
                      <Select
                        id="cu-dept"
                        label="Departamento"
                        labelPosition="outlined"
                        variant="outline"
                        options={departmentOptions}
                        value={departmentId}
                        onChange={setDepartmentId}
                        placeholder="Sin departamento"
                        disabled={busy || departments.length === 0}
                        fullWidth
                      />
                    )}
                  </>
                ) : (
                  <p className="app-shell__muted">Sin permiso para listar departamentos.</p>
                )}
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-job"
                  label="Puesto"
                  labelPosition="outlined"
                  variant="outline"
                  value={jobTitle}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setJobTitle(e.target.value)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="cu-phone"
                  label="Teléfono"
                  labelPosition="outlined"
                  variant="outline"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  disabled={busy}
                  fullWidth
                />
              </div>
            </div>
          </SectionCard>

          {canAssignRole ? (
            <SectionCard
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} strokeWidth={1.75} aria-hidden /> Asignación de Rol Inicial
                </span>
              }
              subtitle="Opcional. Si seleccionas un rol, se vinculará de inmediato al crear el usuario."
            >
              {rolesError ? (
                <p className="welcome-onboarding__error" role="alert">
                  {rolesError}
                </p>
              ) : null}
              {roles.length === 0 && !rolesError ? (
                <p className="app-shell__muted">
                  No hay roles en la empresa. Crea uno en Equipo → Roles y vuelve a intentarlo.
                </p>
              ) : (
                <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <Select
                      id="cu-role"
                      label="Rol inicial"
                      labelPosition="outlined"
                      variant="outline"
                      options={roleOptions}
                      value={roleId}
                      onChange={setRoleId}
                      placeholder="Sin rol (asignar después)"
                      disabled={busy || roles.length === 0}
                      fullWidth
                    />
                  </div>
                </div>
              )}
            </SectionCard>
          ) : null}

          <div className="ecu-companies-form__actions">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Crear Usuario
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={goToList}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}
