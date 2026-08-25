import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  APP_PREFERENCES_EVENT,
  pageSizeOptionsFor,
  preferencesEqual,
  preferencesFromResolvedSettings,
  readAppPreferences,
  writeAppPreferences,
  type AppPreferences,
} from '@/lib/appPreferences'
import { PLATFORM_SETTINGS_UPDATE, upsertUiPreferences } from '@/services/settingsApi'
import {
  selectIsAuthenticated,
  selectSettings,
  setResolvedSettings,
} from '@/store/authSlice'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useAppDispatch, useAppSelector } from '@/store/hooks'

type AppPreferencesContextValue = {
  readonly prefs: AppPreferences
  readonly pageSizeOptions: number[]
  readonly canUpdate: boolean
  readonly persistError: string | null
  readonly patch: (next: Partial<AppPreferences>) => void
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null)

const SAVE_DEBOUNCE_MS = 450

export function AppPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const dispatch = useAppDispatch()
  const authed = useAppSelector(selectIsAuthenticated)
  const settings = useAppSelector(selectSettings)
  const canUpdate = useHasPermission(PLATFORM_SETTINGS_UPDATE)
  const [prefs, setPrefs] = useState<AppPreferences>(() => readAppPreferences())
  const [persistError, setPersistError] = useState<string | null>(null)
  const hydratingRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback((next: AppPreferences) => {
    if (!authed || !canUpdate) {
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      void upsertUiPreferences({
        maxRecords: next.maxRecords,
        defaultLookback: next.defaultLookback,
        palette: next.gluboxTheme,
        density: next.density,
        startDarkMode: next.startDarkMode,
      })
        .then((resolved) => {
          dispatch(setResolvedSettings(resolved))
          setPersistError(null)
        })
        .catch(() => {
          setPersistError('No se pudieron guardar las preferencias en el servidor.')
        })
    }, SAVE_DEBOUNCE_MS)
  }, [authed, canUpdate, dispatch])

  useEffect(() => {
    const sync = () => {
      const next = readAppPreferences()
      setPrefs(next)
      if (!hydratingRef.current) {
        scheduleSave(next)
      }
    }
    window.addEventListener(APP_PREFERENCES_EVENT, sync)
    return () => window.removeEventListener(APP_PREFERENCES_EVENT, sync)
  }, [scheduleSave])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!authed) {
      return
    }
    const next = preferencesFromResolvedSettings(settings, readAppPreferences())
    if (preferencesEqual(next, readAppPreferences())) {
      return
    }
    hydratingRef.current = true
    setPrefs(writeAppPreferences(next))
    hydratingRef.current = false
  }, [authed, settings])

  const patch = useCallback((next: Partial<AppPreferences>) => {
    setPrefs(writeAppPreferences(next))
  }, [])

  const value = useMemo(
    (): AppPreferencesContextValue => ({
      prefs,
      pageSizeOptions: pageSizeOptionsFor(prefs.maxRecords),
      canUpdate,
      persistError,
      patch,
    }),
    [prefs, canUpdate, persistError, patch]
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext)
  if (!ctx) {
    throw new Error('useAppPreferences requiere AppPreferencesProvider')
  }
  return ctx
}
