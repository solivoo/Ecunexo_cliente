export type TenantBranding = {
  name: string
  logoUrl: string | null
  logoLightUrl: string | null
  logoDarkUrl: string | null
  preferWordmark: boolean
  primaryColorHex: string | null
}

export const defaultTenantBranding: TenantBranding = {
  name: 'EcuNexo',
  logoUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  preferWordmark: false,
  primaryColorHex: null,
}
