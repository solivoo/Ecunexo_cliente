import type { ChangeEvent, FormEvent } from 'react'
import { Button, TextBox } from 'glubox'
import { KeyRound } from 'lucide-react'

type EditUserPasswordSectionProps = {
  readonly password: string
  readonly passwordConfirm: string
  readonly onPasswordChange: (value: string) => void
  readonly onPasswordConfirmChange: (value: string) => void
  readonly locked: boolean
  readonly userDisabled: boolean
  readonly passwordBusy: boolean
  readonly onSave: () => void
  readonly onSendEmail: () => void
}

export function EditUserPasswordSection({
  password,
  passwordConfirm,
  onPasswordChange,
  onPasswordConfirmChange,
  locked,
  userDisabled,
  passwordBusy,
  onSave,
  onSendEmail,
}: EditUserPasswordSectionProps) {
  const fieldsLocked = locked || userDisabled

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSave()
  }

  return (
    <form className="ecu-companies-form" onSubmit={onSubmit} noValidate>
      <section className="app-shell__card ecu-companies-form__card">
        <h2 className="app-shell__section-title">
          <KeyRound size={18} strokeWidth={1.75} aria-hidden /> Contraseña
        </h2>
        <p className="ecu-companies-form__hint">
          Define una nueva contraseña aquí, o envía un restablecimiento al correo del usuario
          (contraseña temporal).
        </p>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-password"
              label="Nueva contraseña"
              labelPosition="outlined"
              variant="outline"
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
              disabled={fieldsLocked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <TextBox
              id="eu-password-confirm"
              label="Confirmar contraseña"
              labelPosition="outlined"
              variant="outline"
              type="password"
              value={passwordConfirm}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onPasswordConfirmChange(e.target.value)
              }
              disabled={fieldsLocked}
              fullWidth
              error={passwordConfirm.length > 0 && password !== passwordConfirm}
              errorMessage={
                passwordConfirm.length > 0 && password !== passwordConfirm
                  ? 'No coincide con la contraseña'
                  : undefined
              }
            />
          </div>
        </div>
        {userDisabled ? (
          <p className="welcome-onboarding__error" role="status">
            El usuario está deshabilitado. Habilítalo antes de gestionar la contraseña.
          </p>
        ) : null}
      </section>

      <div className="ecu-companies-form__actions">
        <Button type="submit" variant="primary" loading={passwordBusy} disabled={fieldsLocked}>
          Cambiar contraseña
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={passwordBusy}
          disabled={fieldsLocked}
          onClick={onSendEmail}
        >
          Enviar por correo
        </Button>
      </div>
    </form>
  )
}
