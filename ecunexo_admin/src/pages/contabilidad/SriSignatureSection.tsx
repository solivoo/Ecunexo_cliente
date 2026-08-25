import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { CheckButton, DateBox, FileBox, Select, TextBox } from 'glubox'
import { PenLine } from 'lucide-react'
import {
  BILLING_EMIT_PROFILES,
  getBillingEmitProfile,
  type BillingEmitProfileId,
} from '@/lib/billingEmitProfile'

export type SriSignatureValues = {
  readonly password: string
  readonly expiresAt: string
  readonly autoSign: boolean
  readonly fileName: string | null
  readonly emitProfile: BillingEmitProfileId
}

export type SriSignatureSectionProps = {
  readonly values: SriSignatureValues
  readonly disabled?: boolean
  readonly onChange: <K extends keyof SriSignatureValues>(
    key: K,
    value: SriSignatureValues[K]
  ) => void
}

const PROFILE_OPTIONS = BILLING_EMIT_PROFILES.map((p) => ({
  value: p.value,
  label: p.label,
}))

const CERT_ACCEPT = '.p12,.pfx,application/x-pkcs12'

export function SriSignatureSection({
  values,
  disabled = false,
  onChange,
}: SriSignatureSectionProps) {
  const [certFiles, setCertFiles] = useState<File[]>([])
  const profile = getBillingEmitProfile(values.emitProfile)
  const emitChange: SriSignatureSectionProps['onChange'] = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  const onPickFiles = (files: File[]) => {
    if (disabled) return
    setCertFiles(files)
    emitChange('fileName', files[0]?.name ?? null)
  }

  return (
    <>
      <section className="app-shell__card ecu-companies-form__card">
        <h2 className="app-shell__section-title">
          <PenLine size={18} strokeWidth={1.75} aria-hidden /> Firma electrónica
        </h2>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
          <div className="ecu-companies-form__field">
            <TextBox
              id="sri-cert-password"
              label="Contraseña"
              labelPosition="outlined"
              variant="outline"
              size="md"
              type="password"
              showPasswordToggle
              value={values.password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                emitChange('password', e.target.value)
              }
              autoComplete="new-password"
              disabled={disabled}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <DateBox
              id="sri-cert-expires"
              label="Fecha de expiración *"
              labelPosition="outlined"
              variant="outline"
              size="md"
              value={values.expiresAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                emitChange('expiresAt', e.target.value)
              }
              disabled={disabled}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field sri-config-field--check-align">
            <CheckButton
              variant="ghost"
              checked={values.autoSign}
              onChange={(checked: boolean) => emitChange('autoSign', checked)}
              disabled={disabled}
            >
              Firmado automático
            </CheckButton>
          </div>
          <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
            <FileBox
              id="sri-cert-file"
              label="Certificado digital"
              labelPosition="outlined"
              variant="outline"
              size="md"
              displayMode="dropzone"
              accept={CERT_ACCEPT}
              multiple={false}
              value={certFiles}
              onChange={onPickFiles}
              onReject={(rejected) => {
                if (disabled) return
                if (rejected[0]?.reason === 'type') {
                  emitChange('fileName', null)
                  setCertFiles([])
                }
              }}
              placeholder="Arrastra o selecciona el certificado .p12 / .pfx"
              buttonLabel="Examinar"
              helperText={
                values.fileName
                  ? `Seleccionado: ${values.fileName}`
                  : 'Certificado PKCS#12 (.p12 o .pfx) para firma electrónica SRI.'
              }
              disabled={disabled}
              fullWidth
            />
          </div>
        </div>
      </section>

      <section className="app-shell__card ecu-companies-form__card">
        <h2 className="app-shell__section-title">Modo de emisión</h2>
        <p className="ecu-companies-form__hint">
          Define qué hace Emitir factura: solo validar, firmar, o enviar al SRI (pruebas o
          producción).
        </p>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
          <div className="ecu-companies-form__field">
            <Select
              id="sri-emit-profile"
              label="Perfil"
              labelPosition="outlined"
              variant="outline"
              options={[...PROFILE_OPTIONS]}
              value={values.emitProfile}
              onChange={(v) => emitChange('emitProfile', v as BillingEmitProfileId)}
              disabled={disabled}
              fullWidth
            />
          </div>
        </div>
        <div
          className={
            profile.isDevelopment
              ? 'sri-config-profile-note sri-config-profile-note--dev'
              : 'sri-config-profile-note sri-config-profile-note--prod'
          }
          role="note"
        >
          <p className="sri-config-profile-note__title">
            {profile.isDevelopment ? 'Ambiente de desarrollo' : 'Ambiente de producción'}
          </p>
          <p className="sri-config-profile-note__text">{profile.description}</p>
        </div>
      </section>
    </>
  )
}
