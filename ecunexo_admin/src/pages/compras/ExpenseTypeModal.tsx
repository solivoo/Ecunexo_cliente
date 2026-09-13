import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckButton, DateBox, Popup, Select, TextBox } from 'glubox'
import { AlertCircle, Info } from 'lucide-react'
import type {
  CreateExpenseTypePayload,
  ExpenseTypeDto,
  UpdateExpenseTypePayload,
} from '@/types/purchasesApi'

const SUSTENTO_OPTIONS = [
  { value: '01', label: '01 — Crédito Tributario IVA (Bienes y Servicios)' },
  { value: '02', label: '02 — Costo o Gasto para Impuesto a la Renta' },
  { value: '03', label: '03 — Activo Fijo (Crédito Tributario)' },
  { value: '04', label: '04 — Liquidación de Compra (Sector Agropecuario)' },
  { value: '05', label: '05 — Liquidación de Compra por Reembolso' },
  { value: '06', label: '06 — Costo o Gasto con Devolución de IVA' },
  { value: '07', label: '07 — Gastos de Viaje y Hospedaje' },
  { value: '08', label: '08 — Arrendamiento Mercantil' },
]

const RETENTION_AIR_OPTIONS = [
  { value: '', label: '— Sin código AIR sugerido —', defaultPct: null },
  { value: '312', label: '312 — Compra de Bienes Muebles y Mercadería (2.00%)', defaultPct: '2.00' },
  { value: '307', label: '307 — Mano de obra y mantenimiento (3.00%)', defaultPct: '3.00' },
  { value: '303', label: '303 — Honorarios Profesionales P. Naturales (10.00%)', defaultPct: '10.00' },
  { value: '303A', label: '303A — Honorarios Sociedades / Comisiones (5.00%)', defaultPct: '5.00' },
  { value: '304', label: '304 — Servicios de intelecto sin título profesional (10.00%)', defaultPct: '10.00' },
  { value: '310', label: '310 — Transporte y fletes (1.00%)', defaultPct: '1.00' },
  { value: '320', label: '320 — Arriendo Inmuebles y Bodegas (10.00%)', defaultPct: '10.00' },
  { value: '309', label: '309 — Publicidad, promoción y medios (3.00%)', defaultPct: '3.00' },
  { value: '343', label: '343 — Pagos a proveedores RIMPE Emprendedor (1.00%)', defaultPct: '1.00' },
  { value: '332', label: '332 — Otras compras con retención al 2.00%', defaultPct: '2.00' },
  { value: '344', label: '344 — Otras retenciones de servicios al 3.00%', defaultPct: '3.00' },
  { value: 'custom', label: 'Otro código AIR manual...', defaultPct: null },
]

interface ExpenseTypeModalProps {
  open: boolean
  expenseType: ExpenseTypeDto | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateExpenseTypePayload | UpdateExpenseTypePayload) => Promise<void>
}

export function ExpenseTypeModal({
  open,
  expenseType,
  saving,
  onClose,
  onSave,
}: ExpenseTypeModalProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sriSustentoCode, setSriSustentoCode] = useState('01')
  const [affectsInventory, setAffectsInventory] = useState(false)
  const [selectedRetentionOption, setSelectedRetentionOption] = useState('')
  const [customRetentionCode, setCustomRetentionCode] = useState('')
  const [retentionPercentage, setRetentionPercentage] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFormError(null)
      return
    }

    if (expenseType) {
      setCode(expenseType.code)
      setName(expenseType.name)
      setSriSustentoCode(expenseType.sriSustentoCode || '01')
      setAffectsInventory(expenseType.affectsInventory)
      
      const foundOption = RETENTION_AIR_OPTIONS.find((o) => o.value === expenseType.suggestedRetentionCode)
      if (foundOption) {
        setSelectedRetentionOption(foundOption.value)
        setCustomRetentionCode('')
      } else if (expenseType.suggestedRetentionCode) {
        setSelectedRetentionOption('custom')
        setCustomRetentionCode(expenseType.suggestedRetentionCode)
      } else {
        setSelectedRetentionOption('')
        setCustomRetentionCode('')
      }

      setRetentionPercentage(expenseType.retentionPercentage != null ? String(expenseType.retentionPercentage) : '')
      setValidFrom(expenseType.validFrom ?? '')
      setValidUntil(expenseType.validUntil ?? '')
      setDescription(expenseType.description ?? '')
      setIsActive(expenseType.isActive)
    } else {
      setCode('')
      setName('')
      setSriSustentoCode('01')
      setAffectsInventory(false)
      setSelectedRetentionOption('312')
      setCustomRetentionCode('')
      setRetentionPercentage('2.00')
      setValidFrom('2026-08-06')
      setValidUntil('')
      setDescription('')
      setIsActive(true)
    }
  }, [open, expenseType])

  const handleRetentionOptionChange = (val: string) => {
    setSelectedRetentionOption(val)
    if (val === 'custom') {
      return
    }
    const option = RETENTION_AIR_OPTIONS.find((o) => o.value === val)
    if (option && option.defaultPct !== null) {
      setRetentionPercentage(option.defaultPct)
      if (!validFrom) {
        setValidFrom('2026-08-06')
      }
    } else if (val === '') {
      setRetentionPercentage('')
    }
  }

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault()
      setFormError(null)

      const trimmedCode = code.trim().toUpperCase()
      const trimmedName = name.trim()

      if (!trimmedCode) {
        setFormError('El código del concepto es obligatorio.')
        return
      }

      if (!trimmedName) {
        setFormError('El nombre de la categoría o concepto es obligatorio.')
        return
      }

      let finalRetentionCode: string | null = null
      if (selectedRetentionOption === 'custom') {
        finalRetentionCode = customRetentionCode.trim() || null
      } else if (selectedRetentionOption) {
        finalRetentionCode = selectedRetentionOption
      }

      let parsedPct: number | null = null
      if (retentionPercentage.trim()) {
        const num = parseFloat(retentionPercentage)
        if (isNaN(num) || num < 0 || num > 100) {
          setFormError('El porcentaje de retención debe ser un valor numérico entre 0 y 100%.')
          return
        }
        parsedPct = num
      }

      if (validFrom && validUntil && validFrom > validUntil) {
        setFormError('La fecha de vigencia inicial no puede ser posterior a la fecha final.')
        return
      }

      try {
        if (expenseType) {
          const payload: UpdateExpenseTypePayload = {
            name: trimmedName,
            code: expenseType.isSystem ? undefined : trimmedCode,
            sriSustentoCode,
            affectsInventory,
            suggestedRetentionCode: finalRetentionCode,
            retentionPercentage: parsedPct,
            validFrom: validFrom || null,
            validUntil: validUntil || null,
            description: description.trim() || null,
            isActive,
          }
          await onSave(payload)
        } else {
          const payload: CreateExpenseTypePayload = {
            code: trimmedCode,
            name: trimmedName,
            sriSustentoCode,
            affectsInventory,
            suggestedRetentionCode: finalRetentionCode,
            retentionPercentage: parsedPct,
            validFrom: validFrom || null,
            validUntil: validUntil || null,
            description: description.trim() || null,
          }
          await onSave(payload)
        }
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Error al guardar la categoría.')
      }
    },
    [
      code,
      name,
      sriSustentoCode,
      affectsInventory,
      selectedRetentionOption,
      customRetentionCode,
      retentionPercentage,
      validFrom,
      validUntil,
      description,
      isActive,
      expenseType,
      onSave,
    ]
  )

  const isSystem = Boolean(expenseType?.isSystem)

  return (
    <Popup
      open={open}
      title={expenseType ? 'Editar Categoría / Concepto' : 'Nueva Categoría de Compra'}
      onClose={onClose}
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
          label: saving ? 'Guardando...' : expenseType ? 'Guardar cambios' : 'Crear categoría',
          variant: 'primary',
          onClick: () => void handleSubmit(),
          disabled: saving || !code.trim() || !name.trim(),
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

        {isSystem ? (
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
              marginBottom: '1rem',
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Concepto base SRI:</strong> El código no puede alterarse para preservar la integridad del ATS y validación de compras, pero puedes actualizar su nombre, retención AIR, vigencia o desactivarlo.
            </span>
          </div>
        ) : null}

        <div className="ecu-customer-form__grid">
          {/* Código y Nombre */}
          <div className="ecu-customer-form__field">
            <TextBox
              id="expense-code"
              label="Código del Concepto *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. SERV_MANT"
              value={code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
              fullWidth
              disabled={saving || isSystem}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="expense-name"
              label="Nombre del Concepto / Categoría *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Servicios de Mantenimiento"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Sustento SRI ATS */}
          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <Select
              id="expense-sustento"
              label="Sustento Tributario SRI ATS (Tabla 5) *"
              labelPosition="outlined"
              variant="outline"
              value={sriSustentoCode}
              options={SUSTENTO_OPTIONS}
              onChange={(val: string) => setSriSustentoCode(val)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Retención AIR */}
          <div className="ecu-customer-form__field">
            <Select
              id="expense-retention-code"
              label="Código Sugerido AIR SRI"
              labelPosition="outlined"
              variant="outline"
              value={selectedRetentionOption}
              options={RETENTION_AIR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={handleRetentionOptionChange}
              fullWidth
              disabled={saving}
            />
          </div>

          {selectedRetentionOption === 'custom' ? (
            <div className="ecu-customer-form__field">
              <TextBox
                id="expense-custom-retention-code"
                label="Código AIR Manual *"
                labelPosition="outlined"
                variant="outline"
                placeholder="Ej. 344"
                value={customRetentionCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomRetentionCode(e.target.value)}
                fullWidth
                disabled={saving}
              />
            </div>
          ) : null}

          {/* Porcentaje de Retención */}
          <div className="ecu-customer-form__field">
            <TextBox
              id="expense-retention-pct"
              label="% Retención en la Fuente IR"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. 2.00, 3.00, 10.00"
              type="number"
              value={retentionPercentage}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRetentionPercentage(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Vigencia Desde y Hasta */}
          <div className="ecu-customer-form__field">
            <DateBox
              id="expense-valid-from"
              label="Vigencia Desde"
              labelPosition="outlined"
              variant="outline"
              size="md"
              value={validFrom}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setValidFrom(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <DateBox
              id="expense-valid-until"
              label="Vigencia Hasta (Opcional)"
              labelPosition="outlined"
              variant="outline"
              size="md"
              value={validUntil}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setValidUntil(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Afecta Inventario y Activo */}
          <div className="ecu-customer-form__field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CheckButton
              checked={affectsInventory}
              onChange={(checked: boolean) => setAffectsInventory(checked)}
              disabled={saving}
            >
              Afecta Inventario Físico (Kárdex y Bodega)
            </CheckButton>
          </div>

          {expenseType ? (
            <div className="ecu-customer-form__field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <CheckButton
                checked={isActive}
                onChange={(checked: boolean) => setIsActive(checked)}
                disabled={saving}
              >
                Categoría Activa para nuevas compras
              </CheckButton>
            </div>
          ) : null}

          {/* Descripción */}
          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <TextBox
              id="expense-description"
              label="Descripción o Notas Adicionales"
              labelPosition="outlined"
              variant="outline"
              placeholder="Detalles sobre qué compras abarca esta categoría..."
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
