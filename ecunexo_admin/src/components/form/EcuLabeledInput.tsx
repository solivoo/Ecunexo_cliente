import { useState, type ReactNode } from 'react'

export interface EcuLabeledInputProps {
  readonly id: string
  readonly name?: string
  readonly label: string
  readonly type?: string
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly placeholder?: string
  readonly autoComplete?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly topSlot?: ReactNode
  readonly inputClassName?: string
  readonly groupClassName?: string
  readonly showPasswordToggle?: boolean
}

export function EcuLabeledInput({
  id,
  name,
  label,
  type = 'text',
  value,
  onValueChange,
  placeholder,
  autoComplete,
  required,
  disabled,
  topSlot,
  inputClassName = 'login-page__input',
  groupClassName,
  showPasswordToggle = false,
}: EcuLabeledInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const groupCls = ['login-page__group', groupClassName].filter(Boolean).join(' ')
  const withToggle = type === 'password' && showPasswordToggle
  const inputType = withToggle && passwordVisible ? 'text' : type
  const inputCls = [
    inputClassName,
    withToggle ? 'login-page__input--with-password-toggle' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const inputEl = (
    <input
      id={id}
      name={name}
      type={inputType}
      className={inputCls}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
    />
  )

  return (
    <div className={groupCls}>
      {topSlot}
      <label className="login-page__label" htmlFor={id}>
        {label}
      </label>
      {withToggle ? (
        <div className="login-page__input-password-wrap">
          {inputEl}
          <button
            type="button"
            className="login-page__password-toggle"
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={passwordVisible}
            disabled={disabled}
          >
            <span className="material-symbols-outlined login-page__password-toggle-icon" aria-hidden>
              {passwordVisible ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      ) : (
        inputEl
      )}
    </div>
  )
}

