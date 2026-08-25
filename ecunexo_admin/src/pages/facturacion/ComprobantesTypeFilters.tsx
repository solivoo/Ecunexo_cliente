import { OptionGroup } from 'glubox'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'

type FilterOption = { value: string; label: string }

type ComprobantesTypeFiltersProps = {
  readonly value: string
  readonly options: readonly FilterOption[]
  readonly onChange: (value: string) => void
  readonly disabled?: boolean
  readonly ariaLabel?: string
}

export function ComprobantesTypeFilters({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel = 'Tipo de comprobante',
}: ComprobantesTypeFiltersProps) {
  const size = useGluComponentSize()

  return (
    <div className="ecu-comprobantes-filters" role="group" aria-label={ariaLabel}>
      <OptionGroup
        id="comprobantes-tipo"
        name="comprobantes-tipo"
        options={[...options]}
        value={value}
        onChange={onChange}
        layout="segmented"
        variant="outline"
        disabled={disabled}
        size={size}
      />
    </div>
  )
}
