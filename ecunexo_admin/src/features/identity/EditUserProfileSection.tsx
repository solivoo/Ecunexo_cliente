import type { ChangeEvent, FormEvent } from 'react'
import { Button, Select, TextBox } from 'glubox'
import { UserRound } from 'lucide-react'
import { EditUserProfileHints } from '@/features/identity/EditUserProfileHints'
import type { GetTenantUserDto, RoleListItemDto } from '@/types/identityApi'

type SelectOption = { value: string; label: string }

type EditUserProfileSectionProps = {
  readonly user: GetTenantUserDto
  readonly name: string
  readonly onNameChange: (value: string) => void
  readonly departmentId: string
  readonly onDepartmentChange: (value: string) => void
  readonly departmentOptions: SelectOption[]
  readonly canReadDepartments: boolean
  readonly departmentsCount: number
  readonly jobTitle: string
  readonly onJobTitleChange: (value: string) => void
  readonly phone: string
  readonly onPhoneChange: (value: string) => void
  readonly roleId: string
  readonly onRoleChange: (value: string) => void
  readonly roleOptions: SelectOption[]
  readonly canManageRoles: boolean
  readonly roles: RoleListItemDto[]
  readonly formLocked: boolean
  readonly busy: boolean
  readonly onBack: () => void
  readonly onSubmit: (e: FormEvent) => void
}

function roleReadout(user: GetTenantUserDto, roles: RoleListItemDto[]): string {
  if (user.isCompanyOwner) {
    return roles.find((r) => r.id === user.roleIds[0])?.name ?? 'Administrador (raíz)'
  }
  if (user.roleIds.length > 0) return `${user.roleIds.length} asignado(s)`
  return 'Sin rol'
}

export function EditUserProfileSection({
  user,
  name,
  onNameChange,
  departmentId,
  onDepartmentChange,
  departmentOptions,
  canReadDepartments,
  departmentsCount,
  jobTitle,
  onJobTitleChange,
  phone,
  onPhoneChange,
  roleId,
  onRoleChange,
  roleOptions,
  canManageRoles,
  roles,
  formLocked,
  busy,
  onBack,
  onSubmit,
}: EditUserProfileSectionProps) {
  const canPickDepartment = canReadDepartments && departmentsCount > 0
  const canPickRole = canManageRoles && roles.length > 0 && !user.isCompanyOwner

  return (
    <form className="ecu-companies-form" onSubmit={onSubmit} noValidate>
      <section className="app-shell__card ecu-companies-form__card">
        <h2 className="app-shell__section-title">
          <UserRound size={18} strokeWidth={1.75} aria-hidden /> Perfil
        </h2>
        <p className="ecu-companies-form__hint">
          El correo no se modifica aquí. Nombre es obligatorio.
        </p>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-email"
              label="Correo"
              labelPosition="outlined"
              variant="outline"
              value={user.email}
              disabled
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-name"
              label="Nombre"
              labelPosition="outlined"
              variant="outline"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
              required
              disabled={formLocked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            {canPickDepartment ? (
              <Select
                id="eu-dept"
                label="Departamento"
                labelPosition="outlined"
                variant="outline"
                options={departmentOptions}
                value={departmentId}
                onChange={onDepartmentChange}
                placeholder="Sin departamento"
                disabled={formLocked}
                fullWidth
              />
            ) : (
              <TextBox
                id="eu-dept"
                label="Departamento"
                labelPosition="outlined"
                variant="outline"
                value={user.department ?? ''}
                disabled
                fullWidth
              />
            )}
          </div>
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-job"
              label="Puesto"
              labelPosition="outlined"
              variant="outline"
              value={jobTitle}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onJobTitleChange(e.target.value)}
              disabled={formLocked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-phone"
              label="Teléfono"
              labelPosition="outlined"
              variant="outline"
              value={phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)}
              disabled={formLocked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            {canPickRole ? (
              <Select
                id="eu-role"
                label="Rol"
                labelPosition="outlined"
                variant="outline"
                options={roleOptions}
                value={roleId}
                onChange={onRoleChange}
                placeholder="Selecciona un rol"
                disabled={formLocked}
                fullWidth
              />
            ) : (
              <TextBox
                id="eu-role"
                label="Rol"
                labelPosition="outlined"
                variant="outline"
                value={roleReadout(user, roles)}
                disabled
                fullWidth
              />
            )}
          </div>
        </div>
        <EditUserProfileHints
          user={user}
          canManageRoles={canManageRoles}
          rolesCount={roles.length}
          canPickRole={canPickRole}
        />
      </section>

      <div className="ecu-companies-form__actions">
        <Button type="submit" variant="primary" loading={busy} disabled={formLocked}>
          Guardar perfil
        </Button>
        <Button type="button" variant="outline" disabled={formLocked} onClick={onBack}>
          Atrás
        </Button>
      </div>
    </form>
  )
}
