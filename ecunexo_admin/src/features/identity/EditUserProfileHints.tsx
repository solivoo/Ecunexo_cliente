import type { GetTenantUserDto } from '@/types/identityApi'

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
  const emailHint = user.isCompanyOwner
    ? 'El correo del administrador raíz coincide con el titular de la suscripción y no se cambia aquí. Nombre es obligatorio.'
    : 'Puedes corregir el correo si te equivocaste al crear el usuario. Nombre es obligatorio.'

  const notes: string[] = [emailHint]

  if (canManageRoles && rolesCount === 0) {
    notes.push('No hay roles en el catálogo. Crea uno en Equipo → Roles.')
  }
  if (user.isCompanyOwner) {
    notes.push(
      'Este es el administrador raíz de la empresa (correo del titular). Su rol no se puede cambiar.'
    )
  }
  if (canPickRole) {
    notes.push(
      'El rol es obligatorio. No dejes el selector vacío para evitar que el usuario quede sin permisos.'
    )
  }
  if (!canManageRoles) {
    notes.push(
      'Requieres identity.roles.manage para cambiar el rol. Usa «Asignar rol» en la ficha si tienes permiso.'
    )
  }

  return (
    <ul className="ecu-info-hint__list">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}
