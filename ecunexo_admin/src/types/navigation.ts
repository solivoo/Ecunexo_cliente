export type NavigationLockKind = 'module' | 'permission' | 'placeholder'

export type NavigationNode = {
  id: string
  label: string
  route: string | null
  icon: string | null
  disabled: boolean
  disabledReason: string | null
  placeholder: boolean
  children: NavigationNode[]
  lockKind?: NavigationLockKind | null
  requiredModule?: string | null
}
