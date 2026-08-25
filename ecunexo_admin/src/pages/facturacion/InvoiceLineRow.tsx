import type { ChangeEvent } from 'react'
import { NumberBox, Select, TextBox } from 'glubox'
import { Trash2 } from 'lucide-react'
import {
  IVA_RATE_OPTIONS,
  computeLine,
  formatMoney,
  normalizeLineIvaRate,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceLineProductOption = {
  readonly value: string
  readonly label: string
}

export type InvoiceLineRowProps = {
  readonly line: InvoiceLineDraft
  readonly index: number
  readonly disabled: boolean
  readonly canRemove: boolean
  readonly productOptions: readonly InvoiceLineProductOption[]
  readonly onChange: (lineId: string, patch: Partial<InvoiceLineDraft>) => void
  readonly onRemove: (lineId: string) => void
  readonly onProductChange: (lineId: string, productId: string) => void
}

const IVA_OPTIONS = IVA_RATE_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}))

export function InvoiceLineRow({
  line,
  index,
  disabled,
  canRemove,
  productOptions,
  onChange,
  onRemove,
  onProductChange,
}: InvoiceLineRowProps) {
  const computed = computeLine(line)

  const onNumber =
    (key: 'quantity' | 'unitPrice' | 'discount') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        onChange(line.id, { [key]: 0 })
        return
      }
      const next = Number(raw)
      onChange(line.id, { [key]: Number.isFinite(next) ? Math.max(0, next) : 0 })
    }

  return (
    <tr>
      <td className="factura-emitir__col-sku">
        <Select
          id={`inv-line-sku-${line.id}`}
          variant="outline"
          size="sm"
          options={[...productOptions]}
          value={line.productId}
          placeholder="Seleccionar…"
          disabled={disabled}
          onChange={(value) => onProductChange(line.id, value)}
          fullWidth
        />
      </td>
      <td>
        <TextBox
          id={`inv-line-desc-${line.id}`}
          aria-label={`Descripción línea ${index + 1}`}
          variant="outline"
          size="sm"
          value={line.description}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(line.id, { description: e.target.value })
          }
          fullWidth
        />
      </td>
      <td className="factura-emitir__col-qty">
        <NumberBox
          className="factura-emitir__cell-number"
          aria-label={`Cantidad línea ${index + 1}`}
          variant="outline"
          size="sm"
          min={0}
          step={1}
          showSpinButtons
          value={line.quantity}
          disabled={disabled}
          onChange={onNumber('quantity')}
          fullWidth
        />
      </td>
      <td className="factura-emitir__col-price">
        <NumberBox
          className="factura-emitir__cell-number"
          aria-label={`Precio unitario línea ${index + 1}`}
          variant="outline"
          size="sm"
          min={0}
          step={0.01}
          showSpinButtons
          value={line.unitPrice}
          disabled={disabled}
          onChange={onNumber('unitPrice')}
          fullWidth
        />
      </td>
      <td className="factura-emitir__col-disc">
        <NumberBox
          className="factura-emitir__cell-number"
          aria-label={`Descuento línea ${index + 1}`}
          variant="outline"
          size="sm"
          min={0}
          step={0.01}
          showSpinButtons
          value={line.discount}
          disabled={disabled}
          onChange={onNumber('discount')}
          fullWidth
        />
      </td>
      <td className="factura-emitir__col-iva">
        <Select
          id={`inv-line-iva-${line.id}`}
          variant="outline"
          size="sm"
          options={IVA_OPTIONS}
          value={String(normalizeLineIvaRate(line.ivaRate))}
          disabled={disabled}
          onChange={(value) =>
            onChange(line.id, {
              ivaRate: normalizeLineIvaRate(Number(value)),
            })
          }
          fullWidth
        />
      </td>
      <td className="factura-emitir__col-net">
        <span className="factura-emitir__cell-readonly">
          {formatMoney(computed.lineNet)}
        </span>
      </td>
      <td className="factura-emitir__col-actions">
        <button
          type="button"
          className="factura-emitir__icon-btn"
          disabled={disabled || !canRemove}
          aria-label={`Quitar línea ${index + 1}`}
          onClick={() => onRemove(line.id)}
        >
          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </td>
    </tr>
  )
}
