import { api } from '@/lib/apiClient'

export const PLATFORM_SETTINGS_READ = 'platform.settings.read'
export const PLATFORM_SETTINGS_UPDATE = 'platform.settings.update'

export type ResolvedSettings = Record<string, unknown>

export type UpsertUiPreferencesBody = {
  readonly maxRecords: number
  readonly defaultLookback: string
  readonly palette: string
  readonly density: string
  readonly startDarkMode: boolean
}

export async function upsertUiPreferences(
  body: UpsertUiPreferencesBody,
): Promise<ResolvedSettings> {
  const { data } = await api.put<ResolvedSettings>('/api/v1/settings/ui', body)
  return data
}
