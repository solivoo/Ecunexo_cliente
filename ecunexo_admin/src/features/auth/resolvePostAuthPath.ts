/** Destino tras login / activación según plano titular vs operativo. */
export type PostAuthContext = {
  isSubscriptionHolder: boolean
  tenantId: string | null
  /** Tras activar licencia: abrir wizard de primera empresa. */
  preferCreateCompany?: boolean
}

export function resolvePostAuthPath(ctx: PostAuthContext): string {
  if (ctx.isSubscriptionHolder && !ctx.tenantId) {
    return ctx.preferCreateCompany
      ? '/organizacion/empresas/nueva'
      : '/organizacion/empresas'
  }

  return '/inicio'
}
