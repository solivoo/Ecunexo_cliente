import { CheckButton, Select } from 'glubox'
import { Palette } from 'lucide-react'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import type { GluboxThemeId, UiDensity } from '@/lib/appPreferences'

const THEME_OPTIONS = [
  { value: 'default', label: 'Predeterminado' },
  { value: 'modern', label: 'Moderno' },
  { value: 'enterprise', label: 'Empresarial' },
] as const

const DENSITY_OPTIONS = [
  { value: 'sm', label: 'Compacto (sm)' },
  { value: 'md', label: 'Medio (md)' },
  { value: 'lg', label: 'Grande (lg)' },
] as const

export function AppSettingsAppearanceSection({
  gluboxTheme,
  density,
  startDarkMode,
  disabled = false,
  onThemeChange,
  onDensityChange,
  onStartDarkModeChange,
}: {
  readonly gluboxTheme: GluboxThemeId
  readonly density: UiDensity
  readonly startDarkMode: boolean
  readonly disabled?: boolean
  readonly onThemeChange: (value: GluboxThemeId) => void
  readonly onDensityChange: (value: UiDensity) => void
  readonly onStartDarkModeChange: (value: boolean) => void
}) {
  const size = useGluComponentSize()

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">
        <Palette size={18} strokeWidth={1.75} aria-hidden /> Aspecto
      </h2>
      <p className="ecu-companies-form__hint">
        Paleta gluBox (componentes y chrome de la app), tamaño de controles y modo al abrir.
      </p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
        <div className="ecu-companies-form__field">
          <Select
            id="app-glubox-theme"
            label="Tema"
            labelPosition="outlined"
            variant="outline"
            options={[...THEME_OPTIONS]}
            value={gluboxTheme}
            onChange={(value: string) => onThemeChange(value as GluboxThemeId)}
            disabled={disabled}
            fullWidth
            size={size}
          />
        </div>
        <div className="ecu-companies-form__field">
          <Select
            id="app-density"
            label="Tamaño"
            labelPosition="outlined"
            variant="outline"
            options={[...DENSITY_OPTIONS]}
            value={density}
            onChange={(value: string) => onDensityChange(value as UiDensity)}
            disabled={disabled}
            fullWidth
            size={size}
          />
        </div>
        <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
          <CheckButton
            variant="ghost"
            checked={startDarkMode}
            onChange={onStartDarkModeChange}
            disabled={disabled}
            size={size}
          >
            Iniciar en modo oscuro
          </CheckButton>
        </div>
      </div>
    </section>
  )
}
