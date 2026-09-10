export type CommandCategory = 'Acciones Rápidas' | 'Navegación' | 'Sistema y Preferencias'

export interface CommandPaletteItem {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly category: CommandCategory
  readonly icon: string | React.ReactNode
  readonly badge?: string
  readonly keywords?: string[]
  readonly onSelect: () => void
}
