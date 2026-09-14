import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckButton, Popup, Select, TextBox } from 'glubox'
import { AlertCircle, Info } from 'lucide-react'
import '@/pages/repairs/ecu-customer-form.css'
import type {
  AccountDto,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@/types/accountingApi'
import { ACCOUNT_NATURES, ACCOUNT_TYPES } from '@/types/accountingApi'

interface AccountModalProps {
  open: boolean
  account: AccountDto | null
  parentAccount?: AccountDto | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateAccountPayload | UpdateAccountPayload) => Promise<void>
}

export function AccountModal({
  open,
  account,
  parentAccount,
  saving,
  onClose,
  onSave,
}: AccountModalProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<string>('1')
  const [nature, setNature] = useState<string>('1')
  const [allowsMovement, setAllowsMovement] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFormError(null)
      return
    }

    if (account) {
      setCode(account.code)
      setName(account.name)
      setAccountType(String(account.typeId))
      setNature(String(account.natureId))
      setAllowsMovement(account.allowsMovement)
      setIsActive(account.isActive)
      setDescription(account.description || '')
    } else {
      if (parentAccount) {
        setCode(`${parentAccount.code}.`)
        setAccountType(String(parentAccount.typeId))
        setNature(String(parentAccount.natureId))
      } else {
        setCode('')
        setAccountType('1')
        setNature('1')
      }
      setName('')
      setAllowsMovement(true)
      setIsActive(true)
      setDescription('')
    }
  }, [open, account, parentAccount])

  // Inferencia reactiva de tipo y naturaleza al tipear código nuevo
  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
    if (!account && newCode.trim().length > 0) {
      const firstChar = newCode.trim()[0]
      switch (firstChar) {
        case '1':
          setAccountType('1')
          setNature('1')
          break
        case '2':
          setAccountType('2')
          setNature('2')
          break
        case '3':
          setAccountType('3')
          setNature('2')
          break
        case '4':
          setAccountType('4')
          setNature('2')
          break
        case '5':
          setAccountType('5')
          setNature('1')
          break
      }
    }
  }

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault()
      setFormError(null)

      if (!account && !code.trim()) {
        setFormError('El código contable es obligatorio.')
        return
      }

      if (!name.trim()) {
        setFormError('El nombre o denominación de la cuenta es obligatorio.')
        return
      }

      try {
        if (account) {
          await onSave({
            name: name.trim(),
            description: description.trim() || null,
            allowsMovement,
            isActive,
            nature: Number(nature),
          })
        } else {
          await onSave({
            code: code.trim(),
            name: name.trim(),
            accountType: Number(accountType),
            nature: Number(nature),
            parentAccountId: parentAccount?.id || null,
            parentCode: parentAccount?.code || null,
            allowsMovement,
            description: description.trim() || null,
          })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al guardar la cuenta contable.'
        setFormError(msg)
      }
    },
    [account, code, name, description, allowsMovement, isActive, nature, accountType, parentAccount, onSave]
  )

  const isEditing = Boolean(account)

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={isEditing ? `Editar Cuenta: ${account?.code}` : 'Nueva Cuenta Contable'}
      width="min(92vw, 42rem)"
      actions={[
        {
          id: 'cancel',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
          disabled: saving,
        },
        {
          id: 'save',
          label: saving ? 'Guardando...' : isEditing ? 'Actualizar Cuenta' : 'Crear Cuenta',
          variant: 'primary',
          onClick: () => void handleSubmit(),
          disabled: saving || !name.trim() || (!account && !code.trim()),
          loading: saving,
        },
      ]}
    >
      <form onSubmit={handleSubmit} className="ecu-customer-form" noValidate>
        {formError ? (
          <div className="ecu-form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        ) : null}

        {account?.isSystem ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: 'var(--shell-primary, #2563eb)',
              fontSize: '0.8rem',
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Cuenta Maestra SCVS:</strong> El código contable y grupo NIIF están protegidos para preservar la estructura financiera oficial de la Superintendencia de Compañías.
            </span>
          </div>
        ) : null}

        <div className="ecu-customer-form__grid">
          <div className="ecu-customer-form__field">
            <TextBox
              id="account-code"
              label="Código Contable *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej: 1.1.01.05"
              value={code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleCodeChange(e.target.value)}
              fullWidth
              disabled={isEditing || saving}
            />
            <span className="ecu-customer-form__hint">
              Puntos para subniveles jerárquicos (ej: 5.2.03.02).
            </span>
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="account-name"
              label="Nombre de la Cuenta *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej: Caja Moneda Extranjera"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <Select
              id="account-type"
              label="Grupo NIIF (Tipo) *"
              labelPosition="outlined"
              variant="outline"
              value={accountType}
              onChange={(val: string) => setAccountType(val || '1')}
              options={ACCOUNT_TYPES.map((t) => ({ value: String(t.id), label: t.label }))}
              fullWidth
              disabled={isEditing || saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <Select
              id="account-nature"
              label="Naturaleza Contable *"
              labelPosition="outlined"
              variant="outline"
              value={nature}
              onChange={(val: string) => setNature(val || '1')}
              options={ACCOUNT_NATURES.map((n) => ({ value: String(n.id), label: n.label }))}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Opciones booleanas de comportamiento */}
          <div
            className="ecu-customer-form__field"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <CheckButton
              checked={allowsMovement}
              onChange={(checked: boolean) => setAllowsMovement(checked)}
              disabled={saving}
            >
              Cuenta de Movimiento Transaccional
            </CheckButton>
            <span className="ecu-customer-form__hint">
              Permite imputar asientos, compras y facturación directamente.
            </span>
          </div>

          {isEditing ? (
            <div
              className="ecu-customer-form__field"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            >
              <CheckButton
                checked={isActive}
                onChange={(checked: boolean) => setIsActive(checked)}
                disabled={saving || account?.isSystem}
              >
                Cuenta Activa
              </CheckButton>
              <span className="ecu-customer-form__hint">
                Disponible para selección en módulos operativos.
              </span>
            </div>
          ) : null}

          {/* Descripción / Notas */}
          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <TextBox
              id="account-description"
              label="Descripción / Notas Contables (Opcional)"
              labelPosition="outlined"
              variant="outline"
              placeholder="Propósito contable o reglas de aplicación..."
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>
        </div>
      </form>
    </Popup>
  )
}
