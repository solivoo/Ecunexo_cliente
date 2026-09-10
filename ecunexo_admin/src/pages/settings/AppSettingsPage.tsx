import { useAppPreferences } from '@/features/settings/AppPreferencesProvider'
import { PageHeader, StatusBadge } from '@/components/ui'
import { AppSettingsAppearanceSection } from '@/pages/settings/AppSettingsAppearanceSection'
import { AppSettingsListsSection } from '@/pages/settings/AppSettingsListsSection'
import { AppSettingsSystemSection } from '@/pages/settings/AppSettingsSystemSection'
import { PLATFORM_SETTINGS_READ } from '@/services/settingsApi'
import { useHasPermission } from '@/hooks/useHasPermission'
import type { GluboxThemeId, MaxRecords, ToastPositionId, UiDensity } from '@/lib/appPreferences'
import type { GridLookback } from '@/lib/gridLookback'

export function AppSettingsPage() {
  const { prefs, patch, canUpdate, persistError } = useAppPreferences()
  const canRead = useHasPermission(PLATFORM_SETTINGS_READ)

  if (!canRead) {
    return (
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Preferencias"
          subtitle="No tienes permiso para ver las preferencias de la aplicación."
          badge={<StatusBadge tone="danger">Acceso Restringido</StatusBadge>}
        />
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Preferencias del Sistema"
        subtitle="Personaliza la apariencia, densidad, tema de interfaz, notificaciones y comportamiento de listados."
        badge={<StatusBadge tone="primary">Ajustes</StatusBadge>}
      />
      {persistError ? <p className="ecu-companies-form__hint" role="alert">{persistError}</p> : null}
      {!canUpdate ? (
        <p className="ecu-companies-form__hint">
          Puedes consultar estas preferencias, pero no tienes permiso para cambiarlas.
        </p>
      ) : null}
      <div className="ecu-companies-form">
        <AppSettingsListsSection
          maxRecords={prefs.maxRecords}
          defaultLookback={prefs.defaultLookback}
          disabled={!canUpdate}
          onMaxRecordsChange={(maxRecords: MaxRecords) => patch({ maxRecords })}
          onLookbackChange={(defaultLookback: GridLookback) => patch({ defaultLookback })}
        />
        <AppSettingsAppearanceSection
          gluboxTheme={prefs.gluboxTheme}
          density={prefs.density}
          startDarkMode={prefs.startDarkMode}
          toastPosition={prefs.toastPosition}
          disabled={!canUpdate}
          onThemeChange={(gluboxTheme: GluboxThemeId) => patch({ gluboxTheme })}
          onDensityChange={(density: UiDensity) => patch({ density })}
          onStartDarkModeChange={(startDarkMode: boolean) => patch({ startDarkMode })}
          onToastPositionChange={(toastPosition: ToastPositionId) => patch({ toastPosition })}
        />
        <AppSettingsSystemSection />
      </div>
    </div>
  )
}
