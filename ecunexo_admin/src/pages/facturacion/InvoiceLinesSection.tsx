import { useEffect, useState } from 'react'
import { Button } from 'glubox'
import { Boxes, Package, Plus } from 'lucide-react'
import { SectionCard } from '@/components/ui'
import { InvoiceLineRow } from '@/pages/facturacion/InvoiceLineRow'
import { InvoiceStockCatalogModal } from '@/pages/facturacion/InvoiceStockCatalogModal'
import { InvoiceSummaryBox } from '@/pages/facturacion/InvoiceSummaryBox'
import {
  computeTotals,
  normalizeLineIvaRate,
  type InvoiceLineDraft,
  type InvoiceLineItemKind,
} from '@/pages/facturacion/invoiceFormTypes'
import { listCatalogItems } from '@/services/catalogApi'
import { selectEnabledModules } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'

export type InvoiceLinesSectionProps = {
  readonly tenantId: string | null
  readonly lines: readonly InvoiceLineDraft[]
  readonly disabled?: boolean
  /** Sin tarjeta propia (formulario unificado). */
  readonly embedded?: boolean
  readonly onAdd: () => void
  readonly onRemove: (lineId: string) => void
  readonly onChange: (lineId: string, patch: Partial<InvoiceLineDraft>) => void
  readonly onAddProduct?: (
    product: CatalogItemListItemDto,
    quantity: number,
    targetLineId?: string | null
  ) => void
}

function kindToSnapshot(kind: CatalogItemKind): InvoiceLineItemKind {
  return kind === CatalogItemKind.Physical ? 'physical' : 'service'
}

export function InvoiceLinesSection({
  tenantId,
  lines,
  disabled = false,
  embedded = false,
  onAdd,
  onRemove,
  onChange,
  onAddProduct,
}: InvoiceLinesSectionProps) {
  const totals = computeTotals(lines)
  const enabledModules = useAppSelector(selectEnabledModules)
  const hasCatalog =
    !enabledModules ||
    enabledModules.length === 0 ||
    enabledModules.some((m) => m.toLowerCase() === 'catalog')

  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [activeLineForModal, setActiveLineForModal] = useState<string | null>(null)

  const handleOpenStockModal = (lineId: string | null) => {
    setActiveLineForModal(lineId)
    setIsStockModalOpen(true)
  }

  const handleSelectProductFromModal = (
    item: CatalogItemListItemDto,
    quantity: number,
    targetLineId?: string | null
  ) => {
    if (onAddProduct) {
      onAddProduct(item, quantity, targetLineId)
      return
    }

    if (targetLineId) {
      applyProduct(targetLineId, item.id)
      onChange(targetLineId, { quantity: Math.max(1, quantity) })
      return
    }

    const emptyLine = lines.find((l) => !l.productId && !l.description.trim())
    if (emptyLine) {
      applyProduct(emptyLine.id, item.id)
      onChange(emptyLine.id, { quantity: Math.max(1, quantity) })
    } else {
      onAdd()
    }
  }

  useEffect(() => {
    if (!tenantId || !hasCatalog) {
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const items = await listCatalogItems(tenantId)
        if (!cancelled) {
          setCatalogItems(items)
          setCatalogError(null)
        }
      } catch {
        if (!cancelled) {
          setCatalogItems([])
          setCatalogError('No se pudo cargar el catálogo. Revisa permisos catalog.item.read.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, hasCatalog])

  const applyProduct = (lineId: string, productId: string) => {
    if (!productId) {
      onChange(lineId, {
        productId: '',
        sku: '',
        catalogItemId: null,
        itemKind: null,
      })
      return
    }

    const catalog = catalogItems.find((p) => p.id === productId)
    if (!catalog) {
      onChange(lineId, {
        productId,
        sku: '',
        catalogItemId: null,
        itemKind: null,
      })
      return
    }

    onChange(lineId, {
      productId,
      catalogItemId: catalog.id,
      itemKind: kindToSnapshot(catalog.kind),
      sku: (catalog.sku ?? '').trim().slice(0, 25),
      description: catalog.name,
      unitPrice: catalog.basePrice ?? 0,
      ivaRate: normalizeLineIvaRate(15),
    })
  }

  const content = (
    <div className="factura-emitir__lines-content">
      {catalogError ? (
        <p className="welcome-onboarding__error" role="alert">
          {catalogError}
        </p>
      ) : null}
      {!catalogError && hasCatalog && catalogItems.length === 0 ? (
        <p className="app-shell__muted">
          No hay ítems en Catálogo. Crea productos/servicios en Catálogo → Ítems para seleccionarlos
          aquí.
        </p>
      ) : null}

      <div className="factura-emitir__table-wrap">
        <table className="factura-emitir__table">
          <thead>
            <tr>
              <th scope="col" className="factura-emitir__col-sku">
                Ítem / SKU
              </th>
              <th scope="col">Descripción</th>
              <th scope="col" className="factura-emitir__col-qty">
                Cant.
              </th>
              <th scope="col" className="factura-emitir__col-price">
                P. unit.
              </th>
              <th scope="col" className="factura-emitir__col-disc">
                Desc.
              </th>
              <th scope="col" className="factura-emitir__col-iva">
                IVA
              </th>
              <th scope="col" className="factura-emitir__col-net">
                Neto
              </th>
              <th scope="col" className="factura-emitir__col-actions">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="factura-emitir__table-empty">
                  No hay ítems agregados. Usa el catálogo con stock o agrega una línea manual.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <InvoiceLineRow
                  key={line.id}
                  line={line}
                  index={index}
                  disabled={disabled}
                  canRemove={lines.length > 1}
                  onChange={onChange}
                  onRemove={onRemove}
                  onOpenStockCatalog={handleOpenStockModal}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="factura-emitir__detail-foot">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
          <Plus size={15} strokeWidth={2} aria-hidden />
          Agregar línea
        </Button>

        <InvoiceSummaryBox totals={totals} />
      </div>

      <InvoiceStockCatalogModal
        open={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false)
          setActiveLineForModal(null)
        }}
        tenantId={tenantId}
        targetLineId={activeLineForModal}
        onSelectProduct={handleSelectProductFromModal}
      />
    </div>
  )

  if (embedded) {
    return <div className="factura-emitir__lines">{content}</div>
  }

  return (
    <SectionCard
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={18} strokeWidth={1.75} aria-hidden />
          <span>Detalle de productos y servicios</span>
        </span>
      }
      subtitle="Ítems facturados, inventario, precios e impuestos"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => handleOpenStockModal(null)}
        >
          <Boxes size={15} strokeWidth={1.75} aria-hidden />
          Ver catálogo y stock
        </Button>
      }
    >
      {content}
    </SectionCard>
  )
}
