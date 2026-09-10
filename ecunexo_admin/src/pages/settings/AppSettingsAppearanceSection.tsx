import { CheckButton, Select, useToast } from 'glubox'
import { SectionCard } from '@/components/ui'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import {
  TOAST_POSITION_OPTIONS,
  type GluboxThemeId,
  type ToastPositionId,
  type UiDensity,
} from '@/lib/appPreferences'

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
  toastPosition,
  disabled = false,
  onThemeChange,
  onDensityChange,
  onStartDarkModeChange,
  onToastPositionChange,
}: {
  readonly gluboxTheme: GluboxThemeId
  readonly density: UiDensity
  readonly startDarkMode: boolean
  readonly toastPosition: ToastPositionId
  readonly disabled?: boolean
  readonly onThemeChange: (value: GluboxThemeId) => void
  readonly onDensityChange: (value: UiDensity) => void
  readonly onStartDarkModeChange: (value: boolean) => void
  readonly onToastPositionChange: (value: ToastPositionId) => void
}) {
  const size = useGluComponentSize()
  const toast = useToast()

  const handleToastPositionChange = (value: string) => {
    if (!value) return
    const pos = value as ToastPositionId
    onToastPositionChange(pos)
    const label = TOAST_POSITION_OPTIONS.find((opt) => opt.value === pos)?.label ?? pos
    setTimeout(() => {
      toast.dismissAll?.()
      toast.show({
        title: 'Ubicación de notificaciones',
        message: `Los avisos del sistema se mostrarán en: ${label}.`,
        variant: 'info',
      })
    }, 80)
  }

  return (
    <SectionCard
      title="Aspecto y Experiencia Visual"
      subtitle="Paleta gluBox (componentes y chrome de la app), tamaño de controles, modo al abrir y ubicación de avisos emergentes."
    >
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
        <div className="ecu-companies-form__field">
          <Select
            id="app-toast-position"
            label="Ubicación de notificaciones"
            labelPosition="outlined"
            variant="outline"
            options={[...TOAST_POSITION_OPTIONS]}
            value={toastPosition}
            onChange={handleToastPositionChange}
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
    </SectionCard>
  )
}
