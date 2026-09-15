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

export type EmailSettingsDto = {
  isEnabled: boolean
  host: string
  port: number
  useSsl: boolean
  userName: string
  senderEmail: string
  senderName: string
  hasPassword: boolean
}

export type UpdateEmailSettingsBody = {
  isEnabled: boolean
  host: string
  port: number
  useSsl: boolean
  userName: string
  password?: string
  senderEmail: string
  senderName: string
}

export type TestEmailSettingsBody = {
  targetEmail: string
  host?: string
  port?: number
  useSsl?: boolean
  userName?: string
  password?: string
  senderEmail?: string
  senderName?: string
}

export type TestEmailSettingsResponse = {
  success: boolean
  message: string
}

export async function getEmailSettings(): Promise<EmailSettingsDto> {
  const { data } = await api.get<EmailSettingsDto>('/api/v1/settings/email')
  return data
}

export async function updateEmailSettings(
  body: UpdateEmailSettingsBody,
): Promise<EmailSettingsDto> {
  const { data } = await api.put<EmailSettingsDto>('/api/v1/settings/email', body)
  return data
}

export async function testEmailSettings(
  body: TestEmailSettingsBody,
): Promise<TestEmailSettingsResponse> {
  const { data } = await api.post<TestEmailSettingsResponse>('/api/v1/settings/email/test', body)
  return data
}

