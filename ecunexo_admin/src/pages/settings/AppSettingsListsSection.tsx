import { Select } from 'glubox'
import { List } from 'lucide-react'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { MAX_RECORD_OPTIONS, type MaxRecords } from '@/lib/appPreferences'
import { GRID_LOOKBACK_OPTIONS, type GridLookback } from '@/lib/gridLookback'

const RECORD_OPTIONS = MAX_RECORD_OPTIONS.map((value) => ({
  value: String(value),
  label: `${value} registros`,
}))

const LOOKBACK_OPTIONS = GRID_LOOKBACK_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}))

export function AppSettingsListsSection({
  maxRecords,
  defaultLookback,
  disabled = false,
  onMaxRecordsChange,
  onLookbackChange,
}: {
  readonly maxRecords: MaxRecords
  readonly defaultLookback: GridLookback
  readonly disabled?: boolean
  readonly onMaxRecordsChange: (value: MaxRecords) => void
  readonly onLookbackChange: (value: GridLookback) => void
}) {
  const size = useGluComponentSize()

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">
        <List size={18} strokeWidth={1.75} aria-hidden /> Listados
      </h2>
      <p className="ecu-companies-form__hint">
        Filas por página en todas las tablas, y ventana de fechas al abrir listados masivos
        (comprobantes, compras, SRI). En el grid puedes acotar o ampliar el rango.
      </p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
        <div className="ecu-companies-form__field">
          <Select
            id="app-max-records"
            label="Registros por página"
            labelPosition="outlined"
            variant="outline"
            options={[...RECORD_OPTIONS]}
            value={String(maxRecords)}
            onChange={(value: string) => onMaxRecordsChange(Number(value) as MaxRecords)}
            disabled={disabled}
            fullWidth
            size={size}
          />
        </div>
        <div className="ecu-companies-form__field">
          <Select
            id="app-default-lookback"
            label="Ventana de fechas"
            labelPosition="outlined"
            variant="outline"
            options={LOOKBACK_OPTIONS}
            value={defaultLookback}
            onChange={(value: string) => onLookbackChange(value as GridLookback)}
            disabled={disabled}
            fullWidth
            size={size}
          />
        </div>
      </div>
    </section>
  )
}
