import { useEffect, useMemo, useState } from 'react'
import { Button } from 'glubox'
import { Package, Plus } from 'lucide-react'
import { InvoiceLineRow } from '@/pages/facturacion/InvoiceLineRow'
import { InvoiceSummaryBox } from '@/pages/facturacion/InvoiceSummaryBox'
import {
  computeTotals,
  normalizeLineIvaRate,
  type InvoiceLineDraft,
  type InvoiceLineItemKind,
} from '@/pages/facturacion/invoiceFormTypes'
import { MOCK_PRODUCTS } from '@/pages/facturacion/mockProducts'
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
}: InvoiceLinesSectionProps) {
  const totals = computeTotals(lines)
  const enabledModules = useAppSelector(selectEnabledModules)
  const hasCatalog =
    !enabledModules ||
    enabledModules.length === 0 ||
    enabledModules.some((m) => m.toLowerCase() === 'catalog')

  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])

  useEffect(() => {
    if (!tenantId || !hasCatalog) {
      setCatalogItems([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const items = await listCatalogItems(tenantId)
        if (!cancelled) setCatalogItems(items)
      } catch {
        if (!cancelled) setCatalogItems([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, hasCatalog])

  const productOptions = useMemo(() => {
    if (catalogItems.length > 0) {
      return catalogItems.map((item) => ({
        value: item.id,
        label: item.sku?.trim()
          ? `${item.sku} — ${item.name}`
          : item.name,
      }))
    }
    return MOCK_PRODUCTS.map((p) => ({
      value: p.id,
      label: `${p.sku} — ${p.name}`,
    }))
  }, [catalogItems])

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
    if (catalog) {
      onChange(lineId, {
        productId,
        catalogItemId: catalog.id,
        itemKind: kindToSnapshot(catalog.kind),
        sku: (catalog.sku ?? '').trim().slice(0, 25),
        description: catalog.name,
        unitPrice: catalog.basePrice ?? 0,
        ivaRate: normalizeLineIvaRate(15),
      })
      return
    }

    const mock = MOCK_PRODUCTS.find((p) => p.id === productId)
    if (!mock) {
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
      catalogItemId: null,
      itemKind: null,
      sku: mock.sku,
      description: mock.name,
      unitPrice: mock.unitPrice,
      ivaRate: normalizeLineIvaRate(mock.ivaRate),
    })
  }

  const body = (
    <>
      {!embedded ? (
        <div className="factura-emitir__section-head">
          <h2 className="app-shell__section-title">
            <Package size={18} strokeWidth={1.75} aria-hidden /> Detalle de productos
          </h2>
        </div>
      ) : (
        <p className="factura-emitir__meta-label">Detalle</p>
      )}

      <div className="factura-emitir__table-wrap">
        <table className="factura-emitir__table">
          <thead>
            <tr>
              <th scope="col" className="factura-emitir__col-sku">
                Ítem
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
                  Agregar productos con el botón inferior.
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
                  productOptions={productOptions}
                  onChange={onChange}
                  onRemove={onRemove}
                  onProductChange={applyProduct}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="factura-emitir__detail-foot">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
          Agregar línea
        </Button>

        <InvoiceSummaryBox totals={totals} />
      </div>
    </>
  )

  if (embedded) {
    return <div className="factura-emitir__lines">{body}</div>
  }

  return <section className="app-shell__card ecu-companies-form__card">{body}</section>
}
