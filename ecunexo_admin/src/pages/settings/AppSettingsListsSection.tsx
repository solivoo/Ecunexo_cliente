import { Select } from 'glubox'
import { SectionCard } from '@/components/ui'
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
    <SectionCard
      title="Configuración de Listados"
      subtitle="Filas por página en todas las tablas y ventana de fechas al abrir listados masivos (comprobantes, compras, SRI)."
    >
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
    </SectionCard>
  )
}
