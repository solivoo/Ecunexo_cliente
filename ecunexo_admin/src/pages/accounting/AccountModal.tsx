import { useEffect, useState, type FormEvent } from 'react'
import { Button, CheckButton, Popup, Select, TextBox } from 'glubox'
import { AlertCircle } from 'lucide-react'
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
  }

  const isEditing = !!account

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={isEditing ? `Editar Cuenta: ${account.code}` : 'Nueva Cuenta Contable'}
      width="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Actualizar Cuenta' : 'Crear Cuenta'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {formError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--glb-danger, #ef4444)',
              borderRadius: '8px',
              color: 'var(--glb-danger, #ef4444)',
              fontSize: '0.875rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Código Contable *
            </label>
            <TextBox
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Ej: 1.1.01.05"
              disabled={isEditing || saving}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #94a3b8)', marginTop: '0.25rem', display: 'block' }}>
              Puntos para subniveles.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Nombre de la Cuenta *
            </label>
            <TextBox
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Caja Moneda Extranjera"
              disabled={saving}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Grupo NIIF (Tipo)
            </label>
            <Select
              value={accountType}
              onChange={(val) => setAccountType(val || '1')}
              options={ACCOUNT_TYPES.map((t) => ({ value: String(t.id), label: t.label }))}
              disabled={isEditing || saving}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Naturaleza Contable
            </label>
            <Select
              value={nature}
              onChange={(val) => setNature(val || '1')}
              options={ACCOUNT_NATURES.map((n) => ({ value: String(n.id), label: n.label }))}
              disabled={saving}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--glb-surface-2, rgba(255,255,255,0.03))', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--shell-border, rgba(255,255,255,0.08))' }}>
          <div>
            <CheckButton
              checked={allowsMovement}
              onChange={(checked) => setAllowsMovement(checked)}
              disabled={saving}
            >
              Cuenta de Movimiento Transaccional
            </CheckButton>
            <p style={{ margin: '0.25rem 0 0 1.75rem', fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
              Permite imputar asientos, compras y facturación directamente.
            </p>
          </div>

          {isEditing && (
            <div>
              <CheckButton
                checked={isActive}
                onChange={(checked) => setIsActive(checked)}
                disabled={saving || account?.isSystem}
              >
                Cuenta Activa
              </CheckButton>
              <p style={{ margin: '0.25rem 0 0 1.75rem', fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                Disponible para selección en módulos operativos.
              </p>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
            Descripción / Notas Contables (Opcional)
          </label>
          <TextBox
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Propósito contable o reglas de aplicación..."
            disabled={saving}
          />
        </div>
      </form>
    </Popup>
  )
}
