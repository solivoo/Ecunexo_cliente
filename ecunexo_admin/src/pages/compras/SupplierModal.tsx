import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckButton, Popup, Select, TextBox } from 'glubox'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { validateTaxId } from '@/utils/ecuadorTaxIdValidator'
import type {
  CreateSupplierPayload,
  SupplierDto,
  SupplierIdentificationType,
  SupplierTaxRegime,
  UpdateSupplierPayload,
} from '@/types/purchasesApi'

const IDENTIFICATION_OPTIONS = [
  { value: '1', label: 'RUC (13 dígitos)' },
  { value: '2', label: 'Cédula (10 dígitos)' },
  { value: '3', label: 'Pasaporte' },
]

const REGIME_OPTIONS = [
  { value: '1', label: 'Régimen General' },
  { value: '2', label: 'RIMPE — Emprendedor' },
  { value: '3', label: 'RIMPE — Negocio Popular' },
  { value: '4', label: 'Contribuyente Especial' },
  { value: '5', label: 'Institución Pública' },
]

interface SupplierModalProps {
  open: boolean
  supplier: SupplierDto | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateSupplierPayload | UpdateSupplierPayload) => Promise<void>
}

export function SupplierModal({
  open,
  supplier,
  saving,
  onClose,
  onSave,
}: SupplierModalProps) {
  const [businessName, setBusinessName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [idType, setIdType] = useState<SupplierIdentificationType>(1)
  const [taxId, setTaxId] = useState('')
  const [taxRegime, setTaxRegime] = useState<SupplierTaxRegime>(1)
  const [isRetentionAgent, setIsRetentionAgent] = useState(false)
  const [resolutionNumber, setResolutionNumber] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [creditDays, setCreditDays] = useState('0')
  const [creditLimit, setCreditLimit] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccountType, setBankAccountType] = useState('Corriente')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [formError, setFormError] = useState<string | null>(null)

  // Reset or populate fields when modal opens or supplier changes
  useEffect(() => {
    if (!open) {
      setFormError(null)
      return
    }

    if (supplier) {
      setBusinessName(supplier.businessName)
      setTradeName(supplier.tradeName ?? '')
      setIdType(supplier.identificationType)
      setTaxId(supplier.taxId)
      setTaxRegime(supplier.taxRegime)
      setIsRetentionAgent(supplier.isRetentionAgent)
      setResolutionNumber(supplier.resolutionNumber ?? '')
      setContactEmail(supplier.contactEmail ?? '')
      setContactPhone(supplier.contactPhone ?? '')
      setAddress(supplier.address ?? '')
      setContactPerson(supplier.contactPerson ?? '')
      setCreditDays(String(supplier.creditDays ?? 0))
      setCreditLimit(supplier.creditLimit != null ? String(supplier.creditLimit) : '')
      setBankName(supplier.bankName ?? '')
      setBankAccountType(supplier.bankAccountType ?? 'Corriente')
      setBankAccountNumber(supplier.bankAccountNumber ?? '')
      setNotes(supplier.notes ?? '')
      setIsActive(supplier.isActive)
    } else {
      setBusinessName('')
      setTradeName('')
      setIdType(1)
      setTaxId('')
      setTaxRegime(1)
      setIsRetentionAgent(false)
      setResolutionNumber('')
      setContactEmail('')
      setContactPhone('')
      setAddress('')
      setContactPerson('')
      setCreditDays('0')
      setCreditLimit('')
      setBankName('')
      setBankAccountType('Corriente')
      setBankAccountNumber('')
      setNotes('')
      setIsActive(true)
    }
    setFormError(null)
  }, [open, supplier])

  // Real-time tax ID validation
  const taxIdTypeParam = idType === 1 ? 'ruc' : idType === 2 ? 'cedula' : 'pasaporte'
  const taxValidation = taxId.trim() ? validateTaxId(taxId, taxIdTypeParam) : null

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      setFormError(null)

      if (!businessName.trim()) {
        setFormError('La razón social o nombre comercial es obligatoria.')
        return
      }

      if (!taxId.trim()) {
        setFormError('La identificación fiscal (RUC/Cédula) es obligatoria.')
        return
      }

      if (taxValidation && !taxValidation.isValid) {
        setFormError(taxValidation.error ?? 'La identificación tributaria ingresada no es válida.')
        return
      }

      const parsedCreditDays = parseInt(creditDays, 10)
      const parsedCreditLimit = creditLimit.trim() ? parseFloat(creditLimit) : null

      const basePayload: CreateSupplierPayload = {
        businessName: businessName.trim(),
        tradeName: tradeName.trim() || null,
        identificationType: idType,
        taxRegime,
        taxId: taxId.trim(),
        isRetentionAgent,
        resolutionNumber: isRetentionAgent && resolutionNumber.trim() ? resolutionNumber.trim() : null,
        contactEmail: contactEmail.trim().toLowerCase() || null,
        contactPhone: contactPhone.trim() || null,
        address: address.trim() || null,
        contactPerson: contactPerson.trim() || null,
        creditDays: Number.isNaN(parsedCreditDays) ? 0 : Math.max(0, parsedCreditDays),
        creditLimit: parsedCreditLimit != null && !Number.isNaN(parsedCreditLimit) ? parsedCreditLimit : null,
        bankName: bankName.trim() || null,
        bankAccountType: bankAccountNumber.trim() ? bankAccountType : null,
        bankAccountNumber: bankAccountNumber.trim() || null,
        notes: notes.trim() || null,
      }

      try {
        if (supplier) {
          await onSave({ ...basePayload, isActive })
        } else {
          await onSave(basePayload)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al guardar el proveedor.'
        setFormError(msg)
      }
    },
    [
      businessName,
      taxId,
      taxValidation,
      creditDays,
      creditLimit,
      tradeName,
      idType,
      taxRegime,
      isRetentionAgent,
      resolutionNumber,
      contactEmail,
      contactPhone,
      address,
      contactPerson,
      bankName,
      bankAccountNumber,
      bankAccountType,
      notes,
      supplier,
      onSave,
      isActive,
    ]
  )

  return (
    <Popup
      open={open}
      title={supplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
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
          label: saving ? 'Guardando...' : supplier ? 'Guardar cambios' : 'Crear proveedor',
          variant: 'primary',
          onClick: () => void handleSubmit(),
          disabled: saving || !businessName.trim() || !taxId.trim(),
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

        <div className="ecu-customer-form__grid">
          {/* Identificación y Tipo */}
          <div className="ecu-customer-form__field">
            <Select
              id="supplier-id-type"
              label="Tipo de Identificación *"
              labelPosition="outlined"
              variant="outline"
              value={String(idType)}
              options={IDENTIFICATION_OPTIONS}
              onChange={(val: string) => setIdType(parseInt(val, 10) as SupplierIdentificationType)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-tax-id"
              label="Número de Identificación (RUC/Cédula) *"
              labelPosition="outlined"
              variant="outline"
              placeholder={idType === 1 ? '1790016919001' : idType === 2 ? '1712345678' : 'P1234567'}
              value={taxId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTaxId(e.target.value)}
              fullWidth
              disabled={saving}
            />
            {taxValidation ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.75rem',
                  marginTop: '0.25rem',
                  color: taxValidation.isValid ? 'var(--glb-success, #10b981)' : 'var(--glb-danger, #ef4444)',
                }}
              >
                {taxValidation.isValid ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Identificación válida ante SRI</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} />
                    <span>{taxValidation.error}</span>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* Razón Social y Nombre Comercial */}
          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <TextBox
              id="supplier-business-name"
              label="Razón Social (Registrada en SRI) *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Distribuidora Andina S.A."
              value={businessName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBusinessName(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <TextBox
              id="supplier-trade-name"
              label="Nombre Comercial / Marca (Opcional)"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Andina Import"
              value={tradeName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTradeName(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Régimen Tributario y Retención */}
          <div className="ecu-customer-form__field">
            <Select
              id="supplier-tax-regime"
              label="Régimen Fiscal SRI *"
              labelPosition="outlined"
              variant="outline"
              value={String(taxRegime)}
              options={REGIME_OPTIONS}
              onChange={(val: string) => setTaxRegime(parseInt(val, 10) as SupplierTaxRegime)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CheckButton
              checked={isRetentionAgent}
              onChange={(checked: boolean) => setIsRetentionAgent(checked)}
              disabled={saving}
            >
              Calificado como Agente de Retención SRI
            </CheckButton>
          </div>

          {isRetentionAgent ? (
            <div className="ecu-customer-form__field ecu-customer-form__field--span">
              <TextBox
                id="supplier-resolution-number"
                label="Número de Resolución SRI de Agente de Retención"
                labelPosition="outlined"
                variant="outline"
                placeholder="Ej. NAC-DNCRASC20-00000001"
                value={resolutionNumber}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setResolutionNumber(e.target.value)}
                fullWidth
                disabled={saving}
              />
            </div>
          ) : null}

          {/* Contacto */}
          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-contact-email"
              label="Correo para Retenciones y Facturas"
              labelPosition="outlined"
              variant="outline"
              placeholder="contabilidad@proveedor.com"
              type="email"
              value={contactEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-contact-phone"
              label="Teléfono / WhatsApp Comercial"
              labelPosition="outlined"
              variant="outline"
              placeholder="0991234567"
              value={contactPhone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-contact-person"
              label="Persona / Ejecutivo de Contacto"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Ing. Carlos Ruiz"
              value={contactPerson}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactPerson(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-address"
              label="Dirección Matriz / Ciudad"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Av. Amazonas N24-100, Quito"
              value={address}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Condiciones Comerciales */}
          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-credit-days"
              label="Días de Crédito (0 = Contado)"
              labelPosition="outlined"
              variant="outline"
              type="number"
              value={creditDays}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCreditDays(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-credit-limit"
              label="Límite / Cupo de Crédito (USD)"
              labelPosition="outlined"
              variant="outline"
              type="number"
              placeholder="0.00"
              value={creditLimit}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCreditLimit(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {/* Cuenta Bancaria */}
          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-bank-name"
              label="Banco para Transferencias"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Banco Pichincha, Produbanco"
              value={bankName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBankName(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="supplier-bank-account"
              label="Número de Cuenta Bancaria"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. 2100123456"
              value={bankAccountNumber}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBankAccountNumber(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          {supplier ? (
            <div className="ecu-customer-form__field ecu-customer-form__field--span" style={{ marginTop: '0.5rem' }}>
              <CheckButton
                checked={isActive}
                onChange={(checked: boolean) => setIsActive(checked)}
                disabled={saving}
              >
                Proveedor activo para compras y órdenes
              </CheckButton>
            </div>
          ) : null}
        </div>
      </form>
    </Popup>
  )
}
