import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, TextBox, useToast } from 'glubox'
import { KeyRound } from 'lucide-react'
import { LicenseFileField } from '@/features/onboarding/LicenseFileField'
import { readApiError } from '@/lib/readApiError'
import { applyLicenseUpgrade } from '@/services/onboardingApi'

export type ApplyLicenseSectionProps = {
  readonly disabled?: boolean
  readonly onApplied: () => Promise<void>
}

export function ApplyLicenseSection({ disabled = false, onApplied }: ApplyLicenseSectionProps) {
  const toast = useToast()
  const [activationCode, setActivationCode] = useState('')
  const [licenseArtifact, setLicenseArtifact] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">
        <KeyRound size={18} strokeWidth={1.75} aria-hidden /> Ampliar o modificar licencia
      </h2>
      <p className="ecu-companies-form__hint">
        Canjea un código emitido por Ecunexo para subir cupos (usuarios, empresas) o habilitar
        módulos. No crea otra organización.
      </p>
      {error ? (
        <p className="welcome-onboarding__error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
          <div className="ecu-companies-form__field">
            <TextBox
              id="upgrade-activation-code"
              label="Código de activación"
              labelPosition="outlined"
              variant="outline"
              value={activationCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setActivationCode(e.target.value)}
              disabled={locked}
              required
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <LicenseFileField
              key={fileKey}
              disabled={locked}
              onLoaded={(parsed) => setLicenseArtifact(parsed.artifactJson)}
              onClear={() => setLicenseArtifact('')}
            />
          </div>
        </div>
        <div className="ecu-companies-form__actions">
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={locked}
            fullWidth
          >
            Aplicar código
          </Button>
        </div>
      </form>
    </section>
  )
}
