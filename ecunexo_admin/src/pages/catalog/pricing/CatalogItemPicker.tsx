import { useMemo, useState, type ChangeEvent } from 'react'
import { Select, TextBox } from 'glubox'
import { firstLevelSummary, formatVariantDisplayName } from '@/lib/catalogArchetype'
import type { CatalogItemListItemDto } from '@/types/catalogApi'

const MAX_OPTIONS = 200

type CatalogItemPickerProps = {
  readonly items: readonly CatalogItemListItemDto[]
  readonly value: string
  readonly onChange: (itemId: string) => void
  readonly disabled?: boolean
  readonly searchId: string
  readonly selectId: string
  readonly selectLabel?: string
  readonly placeholder?: string
}

export function CatalogItemPicker({
  items,
  value,
  onChange,
  disabled = false,
  searchId,
  selectId,
  selectLabel = 'Producto',
  placeholder = 'Buscar por nombre o SKU…',
}: CatalogItemPickerProps) {
  const [search, setSearch] = useState('')

  const options = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = term
      ? items.filter((item) => {
          const name = item.name.toLowerCase()
          const sku = (item.sku ?? '').toLowerCase()
          const description = (item.description ?? '').toLowerCase()
          return name.includes(term) || sku.includes(term) || description.includes(term)
        })
      : items

    return filtered.slice(0, MAX_OPTIONS).map((item) => ({
      value: item.id,
      label: (() => {
        const display =
          item.description?.trim() ||
          (item.parentId ? formatVariantDisplayName(item.name, item.parentName ?? null) : item.name)
        const levelSummary = firstLevelSummary(item.hierarchyPathJson)
        return [item.sku, levelSummary, display].filter(Boolean).join(' · ')
      })(),
    }))
  }, [items, search])

  return (
    <div className="ecu-companies-form__grid ecu-companies-form__grid--2" style={{ gap: '0.75rem' }}>
      <div className="ecu-companies-form__field">
        <TextBox
          id={searchId}
          label="Buscar producto"
          labelPosition="outlined"
          variant="outline"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          fullWidth
        />
      </div>
      <div className="ecu-companies-form__field">
        <Select
          id={selectId}
          aria-label={selectLabel}
          label={selectLabel}
          labelPosition="outlined"
          variant="outline"
          options={options}
          value={value}
          onChange={(selected) => onChange(String(selected))}
          disabled={disabled}
          placeholder={
            items.length === 0
              ? 'Cargando catálogo…'
              : options.length === 0
                ? 'Sin coincidencias'
                : 'Selecciona un producto'
          }
        />
      </div>
    </div>
  )
}
