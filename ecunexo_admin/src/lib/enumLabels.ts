export function permissionStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return 'Activo'
    case 1:
      return 'Obsoleto'
    default:
      return String(status)
  }
}

export function policyEffectLabel(effect: number): string {
  return effect === 1 ? 'Deny' : 'Allow'
}

export function tenantStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return 'Prueba'
    case 1:
      return 'Activa'
    case 2:
      return 'Suspendida'
    case 3:
      return 'Eliminada'
    default:
      return String(status)
  }
}
