import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import {
  ArrowLeft,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createRemisionGuide } from '@/services/remisionGuidesApi'
import { getSigningCertificateStatus, getTenant, type SigningCertificateStatusDto } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CreateRemisionGuideItemPayload } from '@/types/remisionGuidesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

const TRANSFER_REASON_OPTIONS = [
  { value: 'Venta de mercadería', label: 'Venta de mercadería (Factura)' },
  { value: 'Traslado entre bodegas', label: 'Traslado entre bodegas de la empresa' },
  { value: 'Consignación', label: 'Entrega en consignación' },
  { value: 'Exportación', label: 'Exportación de productos' },
  { value: 'Devolución', label: 'Devolución de mercadería a proveedor/cliente' },
  { value: 'Servicio de transporte y encomienda', label: 'Servicio de flete y transporte' },
  { value: 'Otros', label: 'Otros motivos autorizados' },
]

const ID_TYPE_OPTIONS = [
  { value: '04', label: '04 — RUC' },
  { value: '05', label: '05 — Cédula de Identidad' },
  { value: '06', label: '06 — Pasaporte' },
  { value: '07', label: '07 — Consumidor Final' },
]

function extractInputValue(e: unknown): string {
  if (e && typeof e === 'object' && 'target' in e) {
    return String((e as { target: { value: unknown } }).target.value ?? '')
  }
  return String(e ?? '')
}

export function RemisionGuideCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canCreate =
    useHasPermission('facturacion.guias.remision.create') ||
    useHasPermission('facturacion.read')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 1. Emisión y Logística
  const today = new Date().toISOString().slice(0, 10)
  const [establishment, setEstablishment] = useState('001')
  const [emissionPoint, setEmissionPoint] = useState('001')
  const [sequential, setSequential] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [licensePlate, setLicensePlate] = useState('')
  const [startingAddress, setStartingAddress] = useState('')

  // 2. Transportista
  const [carrierIdType, setCarrierIdType] = useState('04')
  const [carrierId, setCarrierId] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [carrierPhone, setCarrierPhone] = useState('')
  const [carrierEmail, setCarrierEmail] = useState('')

  // 3. Destinatario y Ruta
  const [recipientIdType, setRecipientIdType] = useState('04')
  const [recipientId, setRecipientId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [transferReason, setTransferReason] = useState('Venta de mercadería')
  const [routeDescription, setRouteDescription] = useState('')

  // 4. Sustento
  const [supportDocType, setSupportDocType] = useState('01')
  const [supportDocNumber, setSupportDocNumber] = useState('')
  const [supportDocAuth, setSupportDocAuth] = useState('')

  // 5. Ítems transportados
  const [items, setItems] = useState<CreateRemisionGuideItemPayload[]>([
    { itemCode: 'ITEM-01', description: 'Cajas de mercadería', quantity: 1, unitOfMeasure: 'UNID' },
  ])

  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      getTenant(tenantId).catch(() => null),
      getSigningCertificateStatus(tenantId).catch(() => null),
    ]).then(([tenantData, certData]) => {
      if (tenantData) {
        setTenant(tenantData)
        if (tenantData.address) setStartingAddress(tenantData.address)
        if (tenantData.establishmentCode) setEstablishment(tenantData.establishmentCode.padEnd(3, '0').slice(0, 3))
      }
      if (certData) setCertStatus(certData)
    })
  }, [tenantId])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemCode: `ITEM-0${prev.length + 1}`,
        description: '',
        quantity: 1,
        unitOfMeasure: 'UNID',
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.show({
        title: 'Atención',
        message: 'Una guía de remisión debe contener al menos un bien transportado.',
        variant: 'warning',
      })
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (
    index: number,
    field: keyof CreateRemisionGuideItemPayload,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handleSave = async (emitSri: boolean) => {
    if (!tenantId) return

    // Validaciones básicas ergonómicas
    if (!licensePlate.trim()) {
      toast.show({
        title: 'Campo obligatorio',
        message: 'Por favor ingresa la placa del vehículo de transporte.',
        variant: 'warning',
      })
      return
    }

    if (!carrierId.trim() || !carrierName.trim()) {
      toast.show({
        title: 'Datos de transportista incompletos',
        message: 'La identificación y nombre del transportista son obligatorios.',
        variant: 'warning',
      })
      return
    }

    if (!recipientId.trim() || !recipientName.trim() || !recipientAddress.trim()) {
      toast.show({
        title: 'Datos de destinatario incompletos',
        message: 'La identificación, nombre y dirección de entrega del destinatario son obligatorios.',
        variant: 'warning',
      })
      return
    }

    if (!routeDescription.trim()) {
      toast.show({
        title: 'Ruta obligatoria',
        message: 'Debes ingresar la ruta del traslado (ej. Quito - Guayaquil).',
        variant: 'warning',
      })
      return
    }

    const invalidItem = items.find((i) => !i.description.trim() || i.quantity <= 0)
    if (invalidItem) {
      toast.show({
        title: 'Ítem inválido',
        message: 'Todos los ítems deben tener descripción y cantidad mayor a cero.',
        variant: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await createRemisionGuide(tenantId, {
        establishment: establishment.trim().padStart(3, '0'),
        emissionPoint: emissionPoint.trim().padStart(3, '0'),
        sequential: sequential.trim() ? sequential.trim().padStart(9, '0') : null,
        issueDate,
        startingAddress: startingAddress.trim(),
        startDate,
        endDate,
        carrierIdentificationType: carrierIdType,
        carrierIdentification: carrierId.trim(),
        carrierName: carrierName.trim(),
        carrierEmail: carrierEmail.trim() || null,
        carrierPhone: carrierPhone.trim() || null,
        licensePlate: licensePlate.trim().toUpperCase(),
        recipientIdentificationType: recipientIdType,
        recipientIdentification: recipientId.trim(),
        recipientName: recipientName.trim(),
        recipientAddress: recipientAddress.trim(),
        transferReason,
        routeDescription: routeDescription.trim(),
        supportDocumentType: supportDocNumber.trim() ? supportDocType : null,
        supportDocumentNumber: supportDocNumber.trim() || null,
        supportDocumentAuth: supportDocAuth.trim() || null,
        items,
        emitSri,
      })

      toast.show({
        title: emitSri ? 'Guía Emitida y Autorizada SRI' : 'Guía Guardada como Borrador',
        message: `Guía N° ${response.documentNumber} registrada con Clave ${response.accessKey.slice(0, 15)}...`,
        variant: 'success',
      })

      navigate('/facturacion/guias-remision')
    } catch (err) {
      toast.show({
        title: 'Error al emitir guía',
        message: readApiError(err, 'No se pudo registrar la guía de remisión.'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!canCreate) {
    return (
      <TenantSessionGate title="Emitir Guía" lead="Emisión de comprobante de remisión.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Sin permiso para emitir guías de remisión (facturacion.guias.remision.create)."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nueva Guía de Remisión"
      lead="Emisión de Guía de Remisión electrónica (SRI Tipo 06) conforme a la Ficha Técnica v2.32."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Emitir Guía de Remisión SRI"
          subtitle={
            tenant?.name
              ? `Comprobante Tipo 06 para ${tenant.name} amparando el traslado de mercaderías.`
              : 'Comprobante Tipo 06 para el amparo del transporte de mercaderías dentro del territorio ecuatoriano.'
          }
          badge={<StatusBadge tone="primary" withDot>SRI Tipo 06</StatusBadge>}
          actions={
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/facturacion/guias-remision')}
                disabled={submitting}
              >
                <ArrowLeft size={16} style={{ marginRight: 4 }} />
                Volver
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSave(false)}
                disabled={submitting}
              >
                <Save size={16} style={{ marginRight: 4 }} />
                Guardar Borrador
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void handleSave(true)}
                disabled={submitting}
              >
                <Send size={16} style={{ marginRight: 4 }} />
                Emitir Guía SRI
              </Button>
            </div>
          }
        />

        {/* Alerta de Firma Electrónica */}
        {certStatus?.isConfigured && !certStatus.isExpired ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1.25rem',
              background: 'color-mix(in srgb, var(--glb-success, #10b981) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--glb-success, #10b981) 25%, transparent)',
              borderRadius: '10px',
              marginBottom: '1.5rem',
            }}
          >
            <ShieldCheck size={20} color="#10b981" />
            <div style={{ fontSize: '0.875rem' }}>
              <strong>Certificado digital listo:</strong> Emisión firmada mediante XAdES-BES{' '}
              {certStatus.subject && `(${certStatus.subject})`}.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1.25rem',
              background: 'color-mix(in srgb, var(--glb-warning, #f59e0b) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--glb-warning, #f59e0b) 25%, transparent)',
              borderRadius: '10px',
              marginBottom: '1.5rem',
            }}
          >
            <Truck size={20} color="#f59e0b" />
            <div style={{ fontSize: '0.875rem' }}>
              <strong>Modo pruebas / simulación SRI:</strong> Se generará la Clave de Acceso de 49 dígitos (Módulo 11) y el XML oficial listo para transmitir.
            </div>
          </div>
        )}

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave(true)
          }}
        >
          {/* 1. Datos de Emisión y Traslado */}
          <SectionCard
            title="1. Datos de Emisión y Logística"
            subtitle="Numeración del comprobante, vehículo y fechas del traslado"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <TextBox
                label="Establecimiento"
                value={establishment}
                onChange={(v) => setEstablishment(extractInputValue(v))}
                maxLength={3}
                placeholder="001"
              />
              <TextBox
                label="Punto de Emisión"
                value={emissionPoint}
                onChange={(v) => setEmissionPoint(extractInputValue(v))}
                maxLength={3}
                placeholder="001"
              />
              <TextBox
                label="Secuencial (Opcional)"
                value={sequential}
                onChange={(v) => setSequential(extractInputValue(v))}
                maxLength={9}
                placeholder="Auto-generado"
              />
              <TextBox
                label="Fecha de Emisión"
                type="date"
                value={issueDate}
                onChange={(v) => setIssueDate(extractInputValue(v))}
              />
              <TextBox
                label="Placa del Vehículo *"
                value={licensePlate}
                onChange={(v) => setLicensePlate(extractInputValue(v).toUpperCase())}
                placeholder="Ej. PBA-1234"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <TextBox
                label="Punto de Partida (Dirección exacta) *"
                value={startingAddress}
                onChange={(v) => setStartingAddress(extractInputValue(v))}
                placeholder="Av. 10 de Agosto y Colón, Quito"
              />
              <TextBox
                label="Fecha Inicio Transporte *"
                type="date"
                value={startDate}
                onChange={(v) => setStartDate(extractInputValue(v))}
              />
              <TextBox
                label="Fecha Fin Transporte *"
                type="date"
                value={endDate}
                onChange={(v) => setEndDate(extractInputValue(v))}
              />
            </div>
          </SectionCard>

          {/* 2. Transportista */}
          <SectionCard
            title="2. Datos del Transportista / Conductor"
            subtitle="Persona natural o jurídica encargada de transportar la carga"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Select
                label="Tipo de Identificación"
                value={carrierIdType}
                onChange={(v) => setCarrierIdType(extractInputValue(v))}
                options={ID_TYPE_OPTIONS}
              />
              <TextBox
                label="RUC o Cédula Transportista *"
                value={carrierId}
                onChange={(v) => setCarrierId(extractInputValue(v))}
                placeholder="1790011223001"
              />
              <TextBox
                label="Razón Social o Nombres Completos *"
                value={carrierName}
                onChange={(v) => setCarrierName(extractInputValue(v))}
                placeholder="Transportes Andinos Cía. Ltda."
              />
              <TextBox
                label="Teléfono Móvil"
                value={carrierPhone}
                onChange={(v) => setCarrierPhone(extractInputValue(v))}
                placeholder="0998877665"
              />
              <TextBox
                label="Correo Electrónico"
                value={carrierEmail}
                onChange={(v) => setCarrierEmail(extractInputValue(v))}
                placeholder="conductor@transportes.ec"
              />
            </div>
          </SectionCard>

          {/* 3. Destinatario y Ruta */}
          <SectionCard
            title="3. Destinatario y Ruta de Entrega"
            subtitle="Cliente o receptor de la mercadería y trayecto del vehículo"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <Select
                label="Tipo Identificación Destinatario"
                value={recipientIdType}
                onChange={(v) => setRecipientIdType(extractInputValue(v))}
                options={ID_TYPE_OPTIONS}
              />
              <TextBox
                label="RUC o Cédula Destinatario *"
                value={recipientId}
                onChange={(v) => setRecipientId(extractInputValue(v))}
                placeholder="0990001234001"
              />
              <TextBox
                label="Razón Social Destinatario *"
                value={recipientName}
                onChange={(v) => setRecipientName(extractInputValue(v))}
                placeholder="Distribuidora del Litoral S.A."
              />
              <TextBox
                label="Dirección de Destino *"
                value={recipientAddress}
                onChange={(v) => setRecipientAddress(extractInputValue(v))}
                placeholder="Av. 9 de Octubre y Boyacá, Guayaquil"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Select
                label="Motivo del Traslado *"
                value={transferReason}
                onChange={(v) => setTransferReason(extractInputValue(v))}
                options={TRANSFER_REASON_OPTIONS}
              />
              <TextBox
                label="Ruta de Transporte (Trayecto) *"
                value={routeDescription}
                onChange={(v) => setRouteDescription(extractInputValue(v))}
                placeholder="Quito - Santo Domingo - Guayaquil"
              />
            </div>
          </SectionCard>

          {/* 4. Comprobante de Sustento */}
          <SectionCard
            title="4. Documento de Sustento Tributario (Opcional)"
            subtitle="Factura de venta o comprobante que ampara los bienes transportados"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Select
                label="Tipo de Comprobante"
                value={supportDocType}
                onChange={(v) => setSupportDocType(extractInputValue(v))}
                options={[{ value: '01', label: '01 — Factura Electrónica' }]}
              />
              <TextBox
                label="Número de Factura Sustentada"
                value={supportDocNumber}
                onChange={(v) => setSupportDocNumber(extractInputValue(v))}
                placeholder="001-001-000012345"
              />
              <TextBox
                label="Autorización / Clave de Acceso (49 dígitos)"
                value={supportDocAuth}
                onChange={(v) => setSupportDocAuth(extractInputValue(v))}
                placeholder="Clave de 49 dígitos del SRI"
              />
            </div>
          </SectionCard>

          {/* 5. Mercadería Transportada */}
          <SectionCard
            title="5. Bienes Transportados (Carga)"
            subtitle="Detalle de productos, bultos o mercancías trasladas"
            action={
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus size={14} style={{ marginRight: 4 }} />
                Agregar Producto
              </Button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 120px 120px 48px',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                    background: 'var(--glb-surface)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glb-border)',
                  }}
                >
                  <TextBox
                    label={index === 0 ? 'Código' : undefined}
                    value={item.itemCode}
                    onChange={(v) => handleItemChange(index, 'itemCode', extractInputValue(v))}
                    placeholder="PROD-001"
                  />
                  <TextBox
                    label={index === 0 ? 'Descripción de la Mercadería *' : undefined}
                    value={item.description}
                    onChange={(v) => handleItemChange(index, 'description', extractInputValue(v))}
                    placeholder="Ej. Cajas de repuestos de motor"
                  />
                  <TextBox
                    label={index === 0 ? 'Cantidad *' : undefined}
                    type="number"
                    value={String(item.quantity)}
                    onChange={(v) => handleItemChange(index, 'quantity', parseFloat(extractInputValue(v)) || 0)}
                    placeholder="1"
                  />
                  <TextBox
                    label={index === 0 ? 'Unidad' : undefined}
                    value={item.unitOfMeasure ?? 'UNID'}
                    onChange={(v) => handleItemChange(index, 'unitOfMeasure', extractInputValue(v))}
                    placeholder="UNID / KG / BULTOS"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title="Eliminar producto"
                    style={{ height: '36px' }}
                    onClick={() => handleRemoveItem(index)}
                  >
                    <Trash2 size={16} color="var(--glb-danger, #ef4444)" />
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
