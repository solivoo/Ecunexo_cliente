import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, NumberBox, Select, TextArea, TextBox, useToast } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { listCatalogItems } from '@/services/catalogApi'
import { approveInventoryDocument, createInventoryDocument, listWarehouses } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, CatalogItemStatus } from '@/types/catalogApi'
import {
  InventoryDocumentType,
  InventoryReceiptOrigin,
  type WarehouseListItemDto,
} from '@/types/inventoryApi'

const PURCHASE_INVOICE = /^\d{3}-\d{3}-\d{9}$/

type LineDraft = { catalogItemId: string; quantity: string }

function initialDocumentType(params: URLSearchParams): string {
  const tipo = params.get('tipo')
  if (tipo === '1') return String(InventoryDocumentType.Issue)
  if (tipo === '2') return String(InventoryDocumentType.Transfer)
  if (tipo === '3') return String(InventoryDocumentType.Adjustment)
  return String(InventoryDocumentType.Receipt)
}

export function CreateInventoryDocumentPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('inventory.documents.create')
  const canApprove = useHasPermission('inventory.documents.approve')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [items, setItems] = useState<{ id: string; name: string; sku: string | null }[]>([])
  const [documentType, setDocumentType] = useState(() => initialDocumentType(params))
  const [warehouseId, setWarehouseId] = useState('')
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptOrigin, setReceiptOrigin] = useState(String(InventoryReceiptOrigin.Opening))
  const [sourceDocumentNumber, setSourceDocumentNumber] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ catalogItemId: '', quantity: '1' }])

  const isTransfer = Number(documentType) === InventoryDocumentType.Transfer
  const isAdjustment = Number(documentType) === InventoryDocumentType.Adjustment
  const isReceipt = Number(documentType) === InventoryDocumentType.Receipt
  const isPurchaseReceipt =
    isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const [wh, catalog] = await Promise.all([
          listWarehouses(tenantId),
          listCatalogItems(tenantId, CatalogItemKind.Physical, CatalogItemStatus.Active),
        ])
        if (cancelled) return
        const operational = wh.filter((w) => w.systemRole !== 1)
        setWarehouses(operational)
        setWarehouseId((current) => current || operational[0]?.id || '')
        setDestinationWarehouseId((current) => current || operational[1]?.id || operational[0]?.id || '')
        setItems(
          catalog
            .filter((c) => c.status === CatalogItemStatus.Active)
            .map((c) => ({ id: c.id, name: c.name, sku: c.sku }))
        )
      } catch {
        if (!cancelled) {
          setWarehouses([])
          setItems([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, tenantId])

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.isMain ? `${w.name} (principal)` : w.name })),
    [warehouses]
  )
  const destinationOptions = useMemo(
    () =>
      warehouses
        .filter((w) => w.id !== warehouseId)
        .map((w) => ({ value: w.id, label: w.isMain ? `${w.name} (principal)` : w.name })),
    [warehouseId, warehouses]
  )
  const itemOptions = useMemo(
    () => items.map((i) => ({ value: i.id, label: i.sku ? `${i.name} (${i.sku})` : i.name })),
    [items]
  )

  const skuOf = useCallback(
    (catalogItemId: string) => items.find((i) => i.id === catalogItemId)?.sku?.trim() || '—',
    [items]
  )

  const goToList = useCallback(() => {
    void navigate('/inventario/documentos')
  }, [navigate])

  const onDocumentTypeChange = useCallback(
    (value: string) => {
      setDocumentType(value)
      const next = new URLSearchParams(params)
      if (value === String(InventoryDocumentType.Receipt)) {
        next.delete('tipo')
      } else {
        next.set('tipo', value)
      }
      const search = next.toString()
      void navigate(
        { pathname: '/inventario/documentos/nuevo', search: search ? `?${search}` : '' },
        { replace: true }
      )
    },
    [navigate, params]
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!warehouseId) throw new Error('Elige una bodega operativa.')
        if (isTransfer && !destinationWarehouseId) {
          throw new Error('Elige la bodega destino.')
        }
        if (isTransfer && destinationWarehouseId === warehouseId) {
          throw new Error('Origen y destino deben ser distintos.')
        }
        if (isAdjustment && !notes.trim()) {
          throw new Error('El ajuste requiere una nota con el motivo del conteo.')
        }
        if (isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase) {
          const invoice = sourceDocumentNumber.trim()
          if (!PURCHASE_INVOICE.test(invoice)) {
            throw new Error('La factura de compra debe ser 001-001-000000123.')
          }
        }
        const parsed = lines
          .map((l) => ({
            catalogItemId: l.catalogItemId,
            quantity: Number(l.quantity.replace(',', '.')),
          }))
          .filter((l) => l.catalogItemId)
        if (parsed.length === 0) throw new Error('Agrega al menos una línea con ítem.')
        if (
          parsed.some((l) =>
            Number.isNaN(l.quantity) || (isAdjustment ? l.quantity < 0 : l.quantity <= 0)
          )
        ) {
          throw new Error(
            isAdjustment
              ? 'Las cantidades contadas no pueden ser negativas.'
              : 'Las cantidades deben ser mayores que cero.'
          )
        }

        const created = await createInventoryDocument(tenantId, {
          documentType: Number(documentType) as InventoryDocumentType,
          warehouseId,
          destinationWarehouseId: isTransfer ? destinationWarehouseId : null,
          notes: notes.trim() || null,
          receiptOrigin: isReceipt ? (Number(receiptOrigin) as InventoryReceiptOrigin) : null,
          sourceDocumentNumber:
            isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase
              ? sourceDocumentNumber.trim()
              : null,
          lines: parsed,
        })

        if (canApprove) {
          await approveInventoryDocument(tenantId, created.documentId)
          toast.show({
            title: isTransfer ? 'Transferencia despachada' : 'Documento aprobado',
            message: isTransfer
              ? 'El stock quedó en tránsito. Confirma la llegada en Documentos → Por recibir.'
              : isAdjustment
                ? 'El saldo se ajustó al conteo físico.'
                : 'El kárdex y el stock ya están actualizados.',
            variant: 'success',
          })
          if (isTransfer) {
            void navigate('/inventario/documentos?cola=recibir', { replace: true })
            return
          }
        } else {
          toast.show({
            title: 'Borrador guardado',
            message: 'Quien tenga permiso de aprobar lo pasará a stock.',
            variant: 'success',
          })
        }
        void navigate('/inventario/documentos', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar el documento.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      canApprove,
      destinationWarehouseId,
      documentType,
      isAdjustment,
      isPurchaseReceipt,
      isReceipt,
      isTransfer,
      lines,
      navigate,
      notes,
      receiptOrigin,
      sourceDocumentNumber,
      tenantId,
      toast,
      warehouseId,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo documento" lead="Recepción, egreso, transferencia o ajuste.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres inventory.documents.create para generar comprobantes de movimiento."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees permisos de emisión de documentos de inventario.
            </p>
            <Button type="button" variant="outline" onClick={goToList}>
              Volver al listado
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nuevo documento"
      lead="Movimiento físico de stock: recepción, egreso, transferencia o ajuste de inventario."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo Documento de Inventario"
          subtitle={
            isTransfer
              ? 'Transferencia entre bodegas. Al despachar, el stock pasa a «En tránsito» y se confirma al recibir en destino.'
              : isAdjustment
                ? 'Ajuste de inventario físico. Al aprobar, se corrige la diferencia positiva o negativa en el kárdex.'
                : isReceipt
                  ? 'Recepción de mercadería. Ingresa unidades al stock de la bodega seleccionada.'
                  : 'Egreso logístico. Disminuye existencias de la bodega de origen.'
          }
          badge={
            <StatusBadge tone="primary" withDot>
              Alta de Comprobante
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={[
                {
                  id: 'list',
                  label: 'Documentos',
                  icon: 'file-text',
                  route: '/inventario/documentos',
                  disabled: false,
                },
              ]}
              variant="outline"
              triggerLabel="Acciones"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title="Cabecera del Movimiento"
            subtitle="Define la naturaleza de la transacción, las bodegas involucradas y referencias comerciales"
          >
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field">
                <Select
                  id="inv-type"
                  label="Tipo de comprobante"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: String(InventoryDocumentType.Receipt), label: 'Recepción (entrada)' },
                    { value: String(InventoryDocumentType.Issue), label: 'Egreso (salida)' },
                    { value: String(InventoryDocumentType.Transfer), label: 'Transferencia entre bodegas' },
                    { value: String(InventoryDocumentType.Adjustment), label: 'Ajuste físico (conteo)' },
                  ]}
                  value={documentType}
                  onChange={onDocumentTypeChange}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <Select
                  id="inv-wh"
                  label={isTransfer ? 'Bodega origen' : 'Bodega'}
                  labelPosition="outlined"
                  variant="outline"
                  options={warehouseOptions}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  disabled={busy || warehouseOptions.length === 0}
                  fullWidth
                />
              </div>
              {isTransfer ? (
                <div className="ecu-companies-form__field">
                  <Select
                    id="inv-wh-dest"
                    label="Bodega destino"
                    labelPosition="outlined"
                    variant="outline"
                    options={destinationOptions}
                    value={destinationWarehouseId}
                    onChange={setDestinationWarehouseId}
                    disabled={busy || destinationOptions.length === 0}
                    fullWidth
                  />
                </div>
              ) : null}
              {isReceipt ? (
                <div
                  className={
                    isPurchaseReceipt
                      ? 'ecu-companies-form__field'
                      : 'ecu-companies-form__field ecu-companies-form__field--span-2'
                  }
                >
                  <Select
                    id="inv-origin"
                    label="Origen de la recepción"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(InventoryReceiptOrigin.Opening), label: 'Inventario inicial' },
                      { value: String(InventoryReceiptOrigin.Purchase), label: 'Compra a proveedor' },
                      { value: String(InventoryReceiptOrigin.Return), label: 'Devolución de cliente' },
                      { value: String(InventoryReceiptOrigin.Other), label: 'Otro concepto' },
                    ]}
                    value={receiptOrigin}
                    onChange={setReceiptOrigin}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              ) : null}
              {isPurchaseReceipt ? (
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="inv-invoice"
                    label="Nº factura proveedor"
                    labelPosition="outlined"
                    variant="outline"
                    value={sourceDocumentNumber}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSourceDocumentNumber(e.target.value)
                    }
                    placeholder="001-001-000000123"
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
              ) : null}
            </div>

            <div className="ecu-companies-form__field" style={{ marginTop: '1rem' }}>
              <TextArea
                id="inv-notes"
                label={isAdjustment ? 'Motivo del ajuste (obligatorio)' : 'Observación / Referencia interna'}
                labelPosition="outlined"
                variant="outline"
                value={notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder={
                  isAdjustment
                    ? 'Indica la justificación del conteo físico o discrepancia…'
                    : 'Anotaciones opcionales para control operativo…'
                }
                rows={2}
                resize="vertical"
                required={isAdjustment}
                disabled={busy}
                fullWidth
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Detalle de Artículos"
            subtitle="Indica los ítems físicos del catálogo y las cantidades correspondientes"
          >
            <div className="ecu-doc-lines__wrap">
              <table className="ecu-doc-lines">
                <thead>
                  <tr>
                    <th scope="col" className="ecu-doc-lines__n">
                      #
                    </th>
                    <th scope="col" className="ecu-doc-lines__sku">
                      SKU
                    </th>
                    <th scope="col">Ítem físico</th>
                    <th scope="col" className="ecu-doc-lines__qty">
                      {isAdjustment ? 'Cantidad contada' : 'Cantidad'}
                    </th>
                    <th scope="col" className="ecu-doc-lines__actions">
                      <span className="visually-hidden">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`line-${index}`}>
                      <td className="ecu-doc-lines__n">{index + 1}</td>
                      <td className="ecu-doc-lines__sku">
                        {line.catalogItemId ? (
                          <code className="ecu-code">{skuOf(line.catalogItemId)}</code>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <Select
                          id={`inv-item-${index}`}
                          aria-label={`Ítem línea ${index + 1}`}
                          variant="outline"
                          size="sm"
                          options={itemOptions}
                          value={line.catalogItemId}
                          placeholder="Seleccionar ítem…"
                          onChange={(value: string) =>
                            setLines((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, catalogItemId: value } : row
                              )
                            )
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </td>
                      <td className="ecu-doc-lines__qty">
                        <NumberBox
                          id={`inv-qty-${index}`}
                          aria-label={`Cantidad línea ${index + 1}`}
                          variant="outline"
                          size="sm"
                          min={0}
                          step={1}
                          showSpinButtons
                          value={Number(line.quantity) || 0}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setLines((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, quantity: e.target.value } : row
                              )
                            )
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </td>
                      <td className="ecu-doc-lines__actions">
                        <button
                          type="button"
                          className="ecu-doc-lines__icon-btn"
                          disabled={busy || lines.length === 1}
                          aria-label={`Quitar línea ${index + 1}`}
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ecu-doc-lines__foot" style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setLines((prev) => [...prev, { catalogItemId: '', quantity: '1' }])}
              >
                <Plus size={15} strokeWidth={2} aria-hidden />
                Agregar línea
              </Button>
            </div>

            <div
              className="ecu-companies-form__actions"
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
              }}
            >
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                {canApprove
                  ? isTransfer
                    ? 'Guardar y Despachar'
                    : 'Guardar y Aprobar'
                  : 'Guardar como Borrador'}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
