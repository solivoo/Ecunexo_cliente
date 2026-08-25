import type { GetTenantUserDto, RoleListItemDto } from '@/types/identityApi'

type EditUserProfileHintsProps = {
  readonly user: GetTenantUserDto
  readonly canManageRoles: boolean
  readonly rolesCount: number
  readonly canPickRole: boolean
}

export function EditUserProfileHints({
  user,
  canManageRoles,
  rolesCount,
  canPickRole,
}: EditUserProfileHintsProps) {
  return (
    <>
      {canManageRoles && rolesCount === 0 ? (
        <p className="app-shell__muted">No hay roles en el catálogo. Crea uno en Equipo → Roles.</p>
      ) : null}
      {user.isCompanyOwner ? (
        <p className="ecu-companies-form__hint">
          Este es el administrador raíz de la empresa (correo del titular). Su rol no se puede
          cambiar.
        </p>
      ) : null}
      {canPickRole ? (
        <p className="ecu-companies-form__hint">
          El rol es obligatorio. No dejes el selector vacío: eso dejaba al usuario sin permisos de
          administración.
        </p>
      ) : null}
      {!canManageRoles ? (
        <p className="app-shell__muted">
          Requieres identity.roles.manage para cambiar el rol. Usa «Asignar rol» en la ficha si
          tienes permiso.
        </p>
      ) : null}
    </>
  )
}
