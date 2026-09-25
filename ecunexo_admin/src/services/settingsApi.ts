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
  encryptionMode?: 'Auto' | 'SslTls' | 'StartTls' | 'None'
  userName: string
  senderEmail: string
  senderName: string
  hasPassword: boolean
  isCustom?: boolean
  scope?: 'Global' | 'Tenant'
}

export type UpdateEmailSettingsBody = {
  isEnabled: boolean
  host: string
  port: number
  useSsl: boolean
  encryptionMode?: string
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
  encryptionMode?: string
  userName?: string
  password?: string
  senderEmail?: string
  senderName?: string
}

export type TestEmailSettingsResponse = {
  success: boolean
  message: string
}

export type EmailTemplateDto = {
  actionCode: string
  actionName: string
  description: string
  subjectTemplate: string
  bodyHtmlTemplate: string
  isCustom: boolean
  availablePlaceholders: string[]
}

export type UpdateEmailTemplateBody = {
  subjectTemplate: string
  bodyHtmlTemplate: string
}

export type PreviewEmailTemplateBody = {
  actionCode: string
  subjectTemplate?: string
  bodyHtmlTemplate?: string
}

export type PreviewEmailTemplateResponse = {
  renderedSubject: string
  renderedHtmlBody: string
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

export async function resetEmailSettings(): Promise<EmailSettingsDto> {
  const { data } = await api.delete<EmailSettingsDto>('/api/v1/settings/email')
  return data
}

export async function testEmailSettings(
  body: TestEmailSettingsBody,
): Promise<TestEmailSettingsResponse> {
  const { data } = await api.post<TestEmailSettingsResponse>('/api/v1/settings/email/test', body)
  return data
}

export async function getEmailTemplates(): Promise<EmailTemplateDto[]> {
  const { data } = await api.get<EmailTemplateDto[]>('/api/v1/settings/email/templates')
  return data
}

export async function updateEmailTemplate(
  actionCode: string,
  body: UpdateEmailTemplateBody,
): Promise<EmailTemplateDto> {
  const { data } = await api.put<EmailTemplateDto>(`/api/v1/settings/email/templates/${encodeURIComponent(actionCode)}`, body)
  return data
}

export async function resetEmailTemplate(actionCode: string): Promise<EmailTemplateDto> {
  const { data } = await api.delete<EmailTemplateDto>(`/api/v1/settings/email/templates/${encodeURIComponent(actionCode)}`)
  return data
}

export async function previewEmailTemplate(
  body: PreviewEmailTemplateBody,
): Promise<PreviewEmailTemplateResponse> {
  const { data } = await api.post<PreviewEmailTemplateResponse>('/api/v1/settings/email/templates/preview', body)
  return data
}

export interface SendInvoiceAuthorizedEmailAttachmentDto {
  readonly fileName: string
  readonly contentType: string
  readonly contentBase64: string
}

export interface SendInvoiceAuthorizedEmailDto {
  readonly billingInvoiceId: string
  readonly counterpartyEmail: string
  readonly counterpartyName: string
  readonly documentType: string
  readonly serieSecuencial: string
  readonly accessKey?: string | null
  readonly grandTotal: number
  readonly attachments?: readonly SendInvoiceAuthorizedEmailAttachmentDto[]
}

export interface SendInvoiceAuthorizedEmailResponse {
  readonly sent: boolean
  readonly to: string
  readonly attachments?: readonly string[]
}

export async function sendInvoiceAuthorizedEmail(
  tenantId: string,
  body: SendInvoiceAuthorizedEmailDto,
): Promise<SendInvoiceAuthorizedEmailResponse> {
  const { data } = await api.post<SendInvoiceAuthorizedEmailResponse>(
    `/api/v1/tenants/${tenantId}/billing/invoice-authorized-email`,
    body,
  )
  return data
}


