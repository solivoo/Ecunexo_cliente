import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, TextBox, useToast } from 'glubox'
import { KeyRound } from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { LicenseFileField } from '@/features/onboarding/LicenseFileField'
import { moduleLabel } from '@/lib/moduleLabels'
import { readApiError } from '@/lib/readApiError'
import { applyLicenseUpgrade } from '@/services/onboardingApi'
import type { ParsedLicenseFile } from '@/utils/licenseFile'

export type ApplyLicenseSectionProps = {
  readonly disabled?: boolean
  readonly onApplied: () => Promise<void>
}

export function ApplyLicenseSection({ disabled = false, onApplied }: ApplyLicenseSectionProps) {
  const toast = useToast()
  const [activationCode, setActivationCode] = useState('')
  const [licenseArtifact, setLicenseArtifact] = useState('')
  const [parsedLicense, setParsedLicense] = useState<ParsedLicenseFile | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canApply = Boolean(activationCode.trim() && licenseArtifact.trim())

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      if (!activationCode.trim() || !licenseArtifact.trim()) {
        setError('Ingresa el código y adjunta el archivo .ecunexo-license.')
        return
      }

      setBusy(true)
      try {
        const result = await applyLicenseUpgrade({
          activationCode: activationCode.trim(),
          licenseArtifact: licenseArtifact.trim(),
        })
        toast.show({
          title: 'Licencia actualizada',
          message: `Plan ${result.servicePlanName}: ${result.maxUsers} usuarios, ${result.subscriptionMaxTenants} empresas.`,
          variant: 'success',
        })
        setActivationCode('')
        setLicenseArtifact('')
        setParsedLicense(null)
        setFileKey((key) => key + 1)
        await onApplied()
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo aplicar el código de licencia.')
        setError(message)
        toast.show({ title: 'No se pudo aplicar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [activationCode, licenseArtifact, onApplied, toast]
  )

  const locked = disabled || busy

  return (
    <SectionCard
      title="Ampliar o Modificar Licencia"
      subtitle="Canjea un código emitido por EcuNexo para subir cupos (usuarios, empresas) o habilitar módulos en esta organización."
    >
      {error ? (
        <div className="ecu-form-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="ecu-license-upgrade-grid">
          {/* Columna 1: Código de activación */}
          <div className="ecu-license-upgrade-col">
            <div className="ecu-license-upgrade-col__header">
              <span className="ecu-license-step-badge">1</span>
              <div>
                <h3 className="ecu-license-step-title">Código de Activación</h3>
                <p className="ecu-license-step-desc">Clave alfanumérica única emitida por EcuNexo</p>
              </div>
            </div>

            <div className="ecu-activation-code-input">
              <TextBox
                id="upgrade-activation-code"
                label="Código de activación"
                labelPosition="outlined"
                variant="outline"
                value={activationCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setActivationCode(e.target.value)}
                placeholder="ECU-XXXX-XXXX-XXXX-XXXX"
                disabled={locked}
                required
                fullWidth
              />
            </div>

            <div className="ecu-license-guide-card">
              <div className="ecu-license-guide-card__row">
                <span className="material-symbols-outlined ecu-license-guide-card__icon">vpn_key</span>
                <div>
                  <strong>Clave Criptográfica Única</strong>
                  <p>Autoriza la vinculación del paquete de licencia directamente a esta organización titular.</p>
                </div>
              </div>
              <div className="ecu-license-guide-card__row">
                <span className="material-symbols-outlined ecu-license-guide-card__icon">verified_user</span>
                <div>
                  <strong>Correspondencia Obligatoria</strong>
                  <p>El código debe coincidir exactamente con el certificado del archivo adjunto para autenticar la firma.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna 2: Archivo de licencia y previsualización */}
          <div className="ecu-license-upgrade-col">
            <div className="ecu-license-upgrade-col__header">
              <span className="ecu-license-step-badge">2</span>
              <div>
                <h3 className="ecu-license-step-title">Archivo de Licencia</h3>
                <p className="ecu-license-step-desc">Archivo criptográfico firmado .ecunexo-license</p>
              </div>
            </div>

            <LicenseFileField
              key={fileKey}
              disabled={locked}
              showInlineSummary={false}
              onLoaded={(parsed) => {
                setLicenseArtifact(parsed.artifactJson)
                setParsedLicense(parsed)
              }}
              onClear={() => {
                setLicenseArtifact('')
                setParsedLicense(null)
              }}
            />

            {parsedLicense ? (
              <div className="ecu-license-detected-card" role="region" aria-label="Paquete de licencia detectado">
                <div className="ecu-license-detected-card__head">
                  <div className="ecu-license-detected-card__title-row">
                    <span className="material-symbols-outlined" style={{ color: 'var(--shell-primary, #2563eb)' }}>
                      task_alt
                    </span>
                    <div>
                      <strong>Paquete Detectado</strong>
                      <span className="ecu-license-detected-card__filename">{parsedLicense.fileName}</span>
                    </div>
                  </div>
                  {parsedLicense.planLabel ? (
                    <StatusBadge tone="primary">{parsedLicense.planLabel}</StatusBadge>
                  ) : null}
                </div>

                {parsedLicense.enabledModules && parsedLicense.enabledModules.length > 0 ? (
                  <div className="ecu-license-detected-card__modules">
                    <span className="ecu-license-detected-card__modules-label">
                      Módulos incluidos ({parsedLicense.enabledModules.length}):
                    </span>
                    <div className="ecu-plan-page__chips">
                      {parsedLicense.enabledModules.map((mod) => (
                        <span key={mod} className="ecu-plan-page__chip">
                          {moduleLabel(mod)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer con estado y botón de acción */}
        <div className="ecu-license-upgrade-footer">
          <div className="ecu-license-upgrade-footer__status">
            {canApply ? (
              <span className="ecu-license-status-ready">
                <span className="material-symbols-outlined">check_circle</span>
                Listo para aplicar actualización
              </span>
            ) : (
              <span className="ecu-license-status-pending">
                <span className="material-symbols-outlined">info</span>
                Ingresa el código y adjunta el archivo .ecunexo-license para continuar.
              </span>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={locked || !canApply}
          >
            <KeyRound size={16} aria-hidden />
            Actualizar Licencia
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
