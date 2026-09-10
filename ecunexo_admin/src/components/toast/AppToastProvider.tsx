import type { ReactNode } from 'react'
import { ToastProvider, type ToastPosition } from 'glubox'
import { useAppPreferences } from '@/features/settings/AppPreferencesProvider'

export interface AppToastProviderProps {
  readonly children: ReactNode
  /**
   * Sobrescribe opcionalmente la posición definida en las preferencias del usuario.
   * Si no se especifica, utiliza la preferencia guardada (por defecto 'bottom-right').
   */
  readonly position?: ToastPosition
  /** Máximo de notificaciones visibles simultáneamente (default 5). */
  readonly maxToasts?: number
  /** Duración predeterminada en milisegundos (default 5000). */
  readonly defaultDuration?: number
  /** Muestra barra de progreso por defecto en toasts con temporizador. */
  readonly showProgress?: boolean
}

/**
 * Componente maestro que envuelve el ToastProvider de gluBox.
 * Lee de forma reactiva la ubicación preferida configurada por el usuario
 * (ubicando los toasts por defecto abajo a la derecha: 'bottom-right').
 */
export function AppToastProvider({
  children,
  position,
  maxToasts,
  defaultDuration,
  showProgress,
}: AppToastProviderProps) {
  const { prefs } = useAppPreferences()
  const activePosition: ToastPosition = position ?? prefs.toastPosition ?? 'bottom-right'

  return (
    <ToastProvider
      position={activePosition}
      maxToasts={maxToasts}
      defaultDuration={defaultDuration}
      showProgress={showProgress}
    >
      {children}
    </ToastProvider>
  )
}
