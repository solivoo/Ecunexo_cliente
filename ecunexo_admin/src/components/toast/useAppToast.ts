import { useMemo, type ReactNode } from 'react'
import { useToast, type ShowToastOptions } from 'glubox'

export interface AppToastApi {
  /** Encola una notificación personalizada (gluBox ShowToastOptions) y devuelve su ID */
  show: (options: ShowToastOptions) => string
  /** Cierra una notificación activa por ID */
  dismiss: (id: string) => void
  /** Cierra todas las notificaciones activas */
  dismissAll: () => void
  /** Notificación de éxito */
  success: (message: ReactNode, title?: ReactNode, options?: Partial<ShowToastOptions>) => string
  /** Notificación de error */
  error: (message: ReactNode, title?: ReactNode, options?: Partial<ShowToastOptions>) => string
  /** Notificación de advertencia */
  warning: (message: ReactNode, title?: ReactNode, options?: Partial<ShowToastOptions>) => string
  /** Notificación informativa */
  info: (message: ReactNode, title?: ReactNode, options?: Partial<ShowToastOptions>) => string
}

/**
 * Hook maestro para disparar notificaciones en la aplicación.
 * Es un wrapper reactivo de `useToast()` de gluBox que añade métodos helper
 * ergonómicos (`success`, `error`, `warning`, `info`).
 */
export function useAppToast(): AppToastApi {
  const toast = useToast()

  return useMemo(
    () => ({
      show: toast.show,
      dismiss: toast.dismiss,
      dismissAll: toast.dismissAll,
      success: (message: ReactNode, title: ReactNode = 'Éxito', options?: Partial<ShowToastOptions>) =>
        toast.show({ ...options, title, message, variant: 'success' }),
      error: (message: ReactNode, title: ReactNode = 'Error', options?: Partial<ShowToastOptions>) =>
        toast.show({ ...options, title, message, variant: 'error' }),
      warning: (message: ReactNode, title: ReactNode = 'Advertencia', options?: Partial<ShowToastOptions>) =>
        toast.show({ ...options, title, message, variant: 'warning' }),
      info: (message: ReactNode, title: ReactNode = 'Información', options?: Partial<ShowToastOptions>) =>
        toast.show({ ...options, title, message, variant: 'info' }),
    }),
    [toast]
  )
}
