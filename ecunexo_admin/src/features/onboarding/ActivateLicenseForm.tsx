import { type ChangeEvent, type FormEvent } from 'react'
import { Button, TextBox } from 'glubox'
import { LicenseFileField } from '@/features/onboarding/LicenseFileField'
import { useActivateLicenseForm } from '@/features/onboarding/useActivateLicenseForm'

type ActivateLicenseFormProps = {
  readonly idPrefix?: string
}

export function ActivateLicenseForm({ idPrefix = 'activate' }: ActivateLicenseFormProps) {
  const form = useActivateLicenseForm()

  return (
    <form
      className="login-page__form login-page__form--glu welcome-onboarding__form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void form.submit()
      }}
      noValidate
    >
      {form.error ? (
        <p className="welcome-onboarding__error" role="alert">
          {form.error}
        </p>
      ) : null}

      <TextBox
        id={`${idPrefix}-activation-code`}
        label="Código de activación"
        labelPosition="outlined"
        variant="outline"
        size="md"
        value={form.activationCode}
        onChange={(e: ChangeEvent<HTMLInputElement>) => form.setActivationCode(e.target.value)}
        placeholder="El código que te envió Ecunexo"
        disabled={form.busy}
        fullWidth
        required
      />

      <LicenseFileField
        disabled={form.busy}
        onLoaded={form.handleLicenseLoaded}
        onClear={form.handleLicenseClear}
      />

      <p className="login-page__muted login-page__muted--compact">
        Cada licencia crea su <strong>organización</strong> (titular). Usa el código y el archivo{' '}
        <code>.ecunexo-license</code>. Si ya eres titular de esa licencia, inicia sesión. Para ampliar
        cupos de una organización existente, entra y usa Plan y licencia.
      </p>

      <Button type="submit" variant="primary" size="md" fullWidth loading={form.busy}>
        {form.busy ? 'Activando licencia…' : 'Activar licencia'}
      </Button>
    </form>
  )
}
