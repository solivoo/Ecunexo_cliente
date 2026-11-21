import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  NumberBox,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import { Calculator, Check, MapPin, Save, Sparkles } from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useAppSelector } from '@/store/hooks'
import { selectTenantId } from '@/store/authSlice'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  calculateShippingCost,
  listCantonShippingRates,
  listEcuadorProvinces,
  listShippingMethods,
  upsertCantonShippingRatesBulk,
} from '@/services/shippingApi'
import type {
  CantonShippingRateItemDto,
  EcuadorProvinceDto,
  ShippingCostCalculationResultDto,
  ShippingMethodDto,
} from '@/types/shippingApi'

type CantonRowDraft = CantonShippingRateItemDto & {
  dirty?: boolean
  actions?: unknown
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('cantón', 'cantones')

export function CantonShippingRatesPage() {
  const tenantId = useAppSelector(selectTenantId)
  const toast = useToast()
  const navigate = useNavigate()

  const [provinces, setProvinces] = useState<EcuadorProvinceDto[]>([])
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('')
  const [originProvinceId, setOriginProvinceId] = useState<string>('')
  const [originCantons, setOriginCantons] = useState<CantonShippingRateItemDto[]>([])
  const [originCantonId, setOriginCantonId] = useState<string>('')
  const [methods, setMethods] = useState<ShippingMethodDto[]>([])
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')

  const [rows, setRows] = useState<CantonRowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Plantilla rápida para aplicar a toda la provincia
  const [bulkBasePrice, setBulkBasePrice] = useState('4.50')
  const [bulkBaseWeightKg, setBulkBaseWeightKg] = useState('2')
  const [bulkAdditionalKgPrice, setBulkAdditionalKgPrice] = useState('1.25')
  const [bulkVolumetricDivisor, setBulkVolumetricDivisor] = useState('6000')
  const [bulkTaxRate, setBulkTaxRate] = useState('15')
  const [bulkEstimatedDays, setBulkEstimatedDays] = useState('24-48h')
  const [bulkFreeMin, setBulkFreeMin] = useState('')

  // Simulador Servientrega (Peso real vs Peso volumétrico)
  const [simCantonId, setSimCantonId] = useState<string>('')
  const [simWeightKg, setSimWeightKg] = useState('2.5')
  const [simLengthCm, setSimLengthCm] = useState('30')
  const [simWidthCm, setSimWidthCm] = useState('25')
  const [simHeightCm, setSimHeightCm] = useState('20')
  const [simSubtotal, setSimSubtotal] = useState('45.00')
  const [simResult, setSimResult] = useState<ShippingCostCalculationResultDto | null>(null)
  const [simBusy, setSimBusy] = useState(false)

  const loadCatalogs = useCallback(async () => {
    if (!tenantId) return
    try {
      const [provList, methodList] = await Promise.all([
        listEcuadorProvinces(),
        listShippingMethods(tenantId, { onlyActive: true }),
      ])
      setProvinces(provList)
      setMethods(methodList)
      if (provList.length > 0 && !selectedProvinceId) {
        const pichincha = provList.find((p) => p.code === '17') ?? provList[0]
        setSelectedProvinceId(pichincha.id)
      }
      if (provList.length > 0 && !originProvinceId) {
        const guayas = provList.find((p) => p.code === '09') ?? provList[0]
        setOriginProvinceId(guayas.id)
      }
    } catch (err) {
      toast.show({
        title: 'Error cargando provincias',
        message: readApiError(err, 'No se pudo cargar el catálogo geográfico de Ecuador.'),
        variant: 'error',
      })
    }
  }, [tenantId, selectedProvinceId, originProvinceId, toast])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  useEffect(() => {
    if (!tenantId || !originProvinceId) {
      return
    }
    let cancelled = false
    listCantonShippingRates(tenantId, originProvinceId)
      .then((list) => {
        if (cancelled) return
        setOriginCantons(list)
        const defaultOrigin = list.find((c) => c.cantonCode === '0901') ?? list[0]
        setOriginCantonId((prev) => (prev && list.some((c) => c.cantonId === prev) ? prev : (defaultOrigin?.cantonId ?? '')))
      })
      .catch(() => {
        if (!cancelled) {
          setOriginCantons([])
          setOriginCantonId('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, originProvinceId])

  const loadProvinceCantons = useCallback(async () => {
    if (!tenantId || !selectedProvinceId) return
    setLoading(true)
    try {
      const list = await listCantonShippingRates(
        tenantId,
        selectedProvinceId,
        selectedMethodId || null,
        originCantonId || null
      )
      setRows(list.map((item) => ({ ...item })))
      if (list.length > 0) {
        const firstEnabled = list.find((c) => c.isEnabled) ?? list[0]
        setSimCantonId(firstEnabled.cantonId)
      } else {
        setSimCantonId('')
      }
      setSimResult(null)
    } catch (err) {
      toast.show({
        title: 'Error cargando cantones',
        message: readApiError(err, 'No se pudieron cargar las tarifas cantonales.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedProvinceId, selectedMethodId, originCantonId, toast])

  useEffect(() => {
    void loadProvinceCantons()
  }, [loadProvinceCantons])

  const updateRowField = useCallback(
    <K extends keyof CantonRowDraft>(cantonId: string, field: K, value: CantonRowDraft[K]) => {
      setRows((prev) =>
        prev.map((row) =>
          row.cantonId === cantonId ? { ...row, [field]: value, dirty: true } : row
        )
      )
    },
    []
  )

  const handleSaveRows = useCallback(
    async (targetRows: CantonRowDraft[]) => {
      if (!tenantId || targetRows.length === 0) return
      setSaving(true)
      try {
        await upsertCantonShippingRatesBulk(tenantId, {
          shippingMethodId: selectedMethodId || null,
          originCantonId: originCantonId || null,
          items: targetRows.map((r) => ({
            cantonId: r.cantonId,
            basePrice: Number(r.basePrice) || 0,
            baseWeightKg: Math.max(0.01, Number(r.baseWeightKg) || 2),
            additionalKgPrice: Number(r.additionalKgPrice) || 0,
            volumetricDivisor: Math.max(1, Number(r.volumetricDivisor) || 6000),
            roundUpExtraKg: r.roundUpExtraKg,
            freeShippingMinAmount:
              r.freeShippingMinAmount != null && r.freeShippingMinAmount >= 0
                ? Number(r.freeShippingMinAmount)
                : null,
            taxRate: Math.min(100, Math.max(0, Number(r.taxRate) || 0)),
            estimatedDays: r.estimatedDays?.trim() || null,
            isEnabled: r.isEnabled,
          })),
        })
        toast.show({
          title: 'Tarifas guardadas',
          message: `Se actualizaron ${targetRows.length} cantón(es) correctamente.`,
          variant: 'success',
        })
        await loadProvinceCantons()
      } catch (err) {
        toast.show({
          title: 'Error al guardar',
          message: readApiError(err, 'No se pudieron guardar las tarifas cantonales.'),
          variant: 'error',
        })
      } finally {
        setSaving(false)
      }
    },
    [tenantId, selectedMethodId, originCantonId, toast, loadProvinceCantons]
  )

  const handleApplyToProvince = () => {
    const basePrice = Math.max(0, Number(bulkBasePrice) || 0)
    const baseWeightKg = Math.max(0.1, Number(bulkBaseWeightKg) || 2)
    const additionalKgPrice = Math.max(0, Number(bulkAdditionalKgPrice) || 0)
    const volumetricDivisor = Math.max(100, Number(bulkVolumetricDivisor) || 6000)
    const taxRate = Math.min(100, Math.max(0, Number(bulkTaxRate) || 0))
    const freeMin = bulkFreeMin.trim() !== '' ? Math.max(0, Number(bulkFreeMin) || 0) : null
    const estimatedDays = bulkEstimatedDays.trim() || null

    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        isEnabled: true,
        basePrice,
        baseWeightKg,
        additionalKgPrice,
        volumetricDivisor,
        taxRate,
        freeShippingMinAmount: freeMin,
        estimatedDays,
        dirty: true,
      }))
    )

    toast.show({
      title: 'Valores aplicados en grilla',
      message: 'Revisa o ajusta cantones puntuales y haz clic en "Guardar cambios".',
      variant: 'info',
    })
  }

  const handleSimulate = async () => {
    if (!tenantId || !simCantonId) return
    setSimBusy(true)
    try {
      const lengthCm = Number(simLengthCm) || 0
      const widthCm = Number(simWidthCm) || 0
      const heightCm = Number(simHeightCm) || 0
      const result = await calculateShippingCost(tenantId, {
        cantonId: simCantonId,
        originCantonId: originCantonId || null,
        shippingMethodId: selectedMethodId || null,
        strategy: 0,
        orderSubtotal: Math.max(0, Number(simSubtotal) || 0),
        overrideActualWeightKg: Math.max(0, Number(simWeightKg) || 0),
        packageDimensions:
          lengthCm > 0 && widthCm > 0 && heightCm > 0
            ? { lengthCm, widthCm, heightCm }
            : null,
      })
      setSimResult(result)
    } catch (err) {
      toast.show({
        title: 'No se pudo calcular',
        message: readApiError(err, 'Verifica que el cantón esté habilitado y guardado.'),
        variant: 'warning',
      })
      setSimResult(null)
    } finally {
      setSimBusy(false)
    }
  }

  const dirtyRows = useMemo(() => rows.filter((r) => r.dirty), [rows])
  const enabledCount = useMemo(() => rows.filter((r) => r.isEnabled).length, [rows])
  const avgBasePrice = useMemo(() => {
    const enabled = rows.filter((r) => r.isEnabled)
    if (enabled.length === 0) return 0
    return enabled.reduce((acc, r) => acc + r.basePrice, 0) / enabled.length
  }, [rows])

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.id === selectedProvinceId) ?? null,
    [provinces, selectedProvinceId]
  )

  const originProvince = useMemo(
    () => provinces.find((p) => p.id === originProvinceId) ?? null,
    [provinces, originProvinceId]
  )

  const handleSuggestByZone = () => {
    if (!selectedProvince) return
    const destRegion = selectedProvince.region.toLowerCase()
    const origRegion = originProvince?.region.toLowerCase() ?? ''
    const isSameProvince = originProvinceId && originProvinceId === selectedProvinceId

    let suggestedBase = '5.50'
    let suggestedDays = '24-48h'

    if (destRegion.includes('galápagos') || destRegion.includes('galapagos') || destRegion.includes('insular')) {
      suggestedBase = '12.00'
      suggestedDays = '72-120h'
    } else if (destRegion.includes('oriente') || destRegion.includes('amaz')) {
      suggestedBase = '7.50'
      suggestedDays = '48-72h'
    } else if (isSameProvince) {
      suggestedBase = '3.50'
      suggestedDays = '24h'
    } else if (origRegion && origRegion === destRegion) {
      suggestedBase = '4.50'
      suggestedDays = '24-48h'
    }

    setBulkBasePrice(suggestedBase)
    setBulkBaseWeightKg('2')
    setBulkAdditionalKgPrice('1.25')
    setBulkVolumetricDivisor('6000')
    setBulkTaxRate('15')
    setBulkEstimatedDays(suggestedDays)

    toast.show({
      title: 'Sugerencia por zona cargada',
      message: `Tarifa sugerida ($${suggestedBase}, ${suggestedDays}). Haz clic en "Aplicar a toda la provincia" para llenar la grilla.`,
      variant: 'info',
    })
  }

  const columns: ColumnDef<CantonRowDraft>[] = useMemo(
    () => [
      {
        key: 'cantonName',
        header: 'Cantón',
        minWidth: 190,
        renderCell: (_val, row) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontWeight: row.isProvincialCapital ? 700 : 500 }}>
              {row.cantonName}
            </span>
            {row.isProvincialCapital && <StatusBadge tone="info">Capital</StatusBadge>}
            {row.dirty && <StatusBadge tone="warning">Editado</StatusBadge>}
          </div>
        ),
      },
      {
        key: 'isEnabled',
        header: 'Habilitado',
        width: 100,
        renderCell: (_val, row) => (
          <input
            type="checkbox"
            checked={row.isEnabled}
            onChange={(e) => updateRowField(row.cantonId, 'isEnabled', e.target.checked)}
            aria-label={`Habilitar ${row.cantonName}`}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
        ),
      },
      {
        key: 'basePrice',
        header: 'Tarifa Base ($)',
        width: 130,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            step={0.1}
            value={row.basePrice}
            onChange={(e) =>
              updateRowField(row.cantonId, 'basePrice', Math.max(0, Number(e.target.value) || 0))
            }
            fullWidth
          />
        ),
      },
      {
        key: 'baseWeightKg',
        header: 'Peso Base (kg)',
        width: 125,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0.1}
            step={0.5}
            value={row.baseWeightKg}
            onChange={(e) =>
              updateRowField(
                row.cantonId,
                'baseWeightKg',
                Math.max(0.1, Number(e.target.value) || 2)
              )
            }
            fullWidth
          />
        ),
      },
      {
        key: 'additionalKgPrice',
        header: 'Kg Adic. ($)',
        width: 120,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            step={0.1}
            value={row.additionalKgPrice}
            onChange={(e) =>
              updateRowField(
                row.cantonId,
                'additionalKgPrice',
                Math.max(0, Number(e.target.value) || 0)
              )
            }
            fullWidth
          />
        ),
      },
      {
        key: 'volumetricDivisor',
        header: 'Factor Vol.',
        width: 120,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={100}
            step={500}
            value={row.volumetricDivisor}
            onChange={(e) =>
              updateRowField(
                row.cantonId,
                'volumetricDivisor',
                Math.max(100, Number(e.target.value) || 6000)
              )
            }
            fullWidth
          />
        ),
      },
      {
        key: 'freeShippingMinAmount',
        header: 'Gratis desde ($)',
        width: 135,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            step={1}
            placeholder="Opcional"
            value={row.freeShippingMinAmount ?? undefined}
            onChange={(e) => {
              const raw = e.target.value.trim()
              updateRowField(
                row.cantonId,
                'freeShippingMinAmount',
                raw === '' ? null : Math.max(0, Number(raw) || 0)
              )
            }}
            fullWidth
          />
        ),
      },
      {
        key: 'taxRate',
        header: 'IVA (%)',
        width: 95,
        renderCell: (_val, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            max={100}
            step={1}
            value={row.taxRate}
            onChange={(e) =>
              updateRowField(
                row.cantonId,
                'taxRate',
                Math.min(100, Math.max(0, Number(e.target.value) || 0))
              )
            }
            fullWidth
          />
        ),
      },
      {
        key: 'estimatedDays',
        header: 'Entrega Est.',
        width: 130,
        renderCell: (_val, row) => (
          <TextBox
            size="sm"
            variant="outline"
            value={row.estimatedDays ?? ''}
            placeholder="24-48h"
            onChange={(e) => updateRowField(row.cantonId, 'estimatedDays', e.target.value)}
            fullWidth
          />
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: 120,
        sticky: 'right',
        renderCell: (_val, row) => (
          <Button
            size="sm"
            variant={row.dirty ? 'primary' : 'outline'}
            disabled={saving}
            onClick={() => void handleSaveRows([row])}
            iconLeft={<Check size={14} />}
          >
            Guardar
          </Button>
        ),
      },
    ],
    [saving, handleSaveRows, updateRowField]
  )

  return (
    <TenantSessionGate
      title="Tarifas por Provincia y Cantón"
      lead="Configura envíos por cantón del Ecuador con cálculo de peso real vs. volumétrico."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Tarifas de Envío por Provincia y Cantón"
          info="Selecciona una provincia del Ecuador para configurar sus cantones (tarifa base, kg adicional y factor volumétrico estilo Servientrega)."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                onClick={() => navigate('/ecommerce/envios/tarifas')}
              >
                Reglas por Volumen
              </Button>
              <Button
                variant="primary"
                disabled={saving || dirtyRows.length === 0}
                onClick={() => void handleSaveRows(dirtyRows)}
                iconLeft={<Save size={16} />}
              >
                {saving
                  ? 'Guardando...'
                  : `Guardar cambios (${dirtyRows.length})`}
              </Button>
            </div>
          }
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <StatCard
            label="Provincia seleccionada"
            value={selectedProvince ? `${selectedProvince.name} (${selectedProvince.region})` : '—'}
          />
          <StatCard label="Cantones en provincia" value={rows.length} />
          <StatCard label="Cantones habilitados" value={enabledCount} />
          <StatCard label="Tarifa base promedio" value={`$${avgBasePrice.toFixed(2)}`} />
        </div>

        <SectionCard
          title="Selección de Provincia y Plantilla Rápida"
          info="Elige la provincia y, si deseas, aplica una tarifa base uniforme a todos sus cantones antes de ajustar excepciones."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem',
              alignItems: 'end',
            }}
          >
            <Select
              id="ec-origin-province-select"
              label="Provincia Origen (Establecimiento)"
              labelPosition="outlined"
              variant="outline"
              value={originProvinceId}
              onChange={(val) => {
                setOriginProvinceId(val)
                if (!val) {
                  setOriginCantons([])
                  setOriginCantonId('')
                }
              }}
              options={[
                { value: '', label: 'Global (sin origen específico)' },
                ...provinces.map((p) => ({
                  value: p.id,
                  label: `${p.code} · ${p.name}`,
                })),
              ]}
              fullWidth
            />

            <Select
              id="ec-origin-canton-select"
              label="Ciudad / Cantón Origen"
              labelPosition="outlined"
              variant="outline"
              value={originCantonId}
              onChange={(val) => setOriginCantonId(val)}
              options={[
                { value: '', label: 'Tarifa global (cualquier origen)' },
                ...originCantons.map((c) => ({
                  value: c.cantonId,
                  label: c.cantonName,
                })),
              ]}
              fullWidth
            />

            <Select
              id="ec-province-select"
              label="Provincia Destino (Ecuador)"
              labelPosition="outlined"
              variant="outline"
              value={selectedProvinceId}
              onChange={(val) => setSelectedProvinceId(val)}
              options={provinces.map((p) => ({
                value: p.id,
                label: `${p.code} · ${p.name} (${p.region})`,
              }))}
              fullWidth
            />

            <Select
              id="ec-method-select"
              label="Método / Courier (opcional)"
              labelPosition="outlined"
              variant="outline"
              value={selectedMethodId}
              onChange={(val) => setSelectedMethodId(val)}
              options={[
                { value: '', label: 'Tarifa general (todos los couriers)' },
                ...methods.map((m) => ({ value: m.id, label: m.name })),
              ]}
              fullWidth
            />

            <NumberBox
              label="Tarifa Base ($)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              step={0.1}
              value={Number(bulkBasePrice)}
              onChange={(e) => setBulkBasePrice(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Peso Base (kg)"
              labelPosition="outlined"
              variant="outline"
              min={0.1}
              step={0.5}
              value={Number(bulkBaseWeightKg)}
              onChange={(e) => setBulkBaseWeightKg(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Kg Adicional ($)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              step={0.1}
              value={Number(bulkAdditionalKgPrice)}
              onChange={(e) => setBulkAdditionalKgPrice(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Factor Volumétrico"
              labelPosition="outlined"
              variant="outline"
              min={100}
              step={500}
              value={Number(bulkVolumetricDivisor)}
              onChange={(e) => setBulkVolumetricDivisor(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="IVA (%)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              max={100}
              value={Number(bulkTaxRate)}
              onChange={(e) => setBulkTaxRate(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Envío gratis desde ($)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              placeholder="Opcional"
              value={bulkFreeMin !== '' ? Number(bulkFreeMin) : undefined}
              onChange={(e) => setBulkFreeMin(e.target.value)}
              fullWidth
            />
            <TextBox
              label="Tiempo estimado"
              labelPosition="outlined"
              variant="outline"
              value={bulkEstimatedDays}
              onChange={(e) => setBulkEstimatedDays(e.target.value)}
              fullWidth
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggestByZone}
              disabled={!selectedProvince || saving}
            >
              Sugerir por zona
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyToProvince}
              disabled={rows.length === 0 || saving}
              iconLeft={<Sparkles size={16} />}
            >
              Aplicar a toda la provincia
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <MapPin size={18} />
              <span>
                Cantones de {selectedProvince?.name ?? 'Ecuador'} ({rows.length})
              </span>
            </span>
          }
          info="Fórmula courier: Peso facturable = máx(Peso real, (L × A × H cm) / Factor Volumétrico). Si supera Peso Base, se suma cada kg adicional."
        >
          <DataGrid
            dataSource={rows}
            columns={columns}
            keyExpr="cantonId"
            loading={loading}
            showSearch
            messages={gridMessages}
          />
        </SectionCard>

        <SectionCard
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <Calculator size={18} />
              <span>Simulador de Costo de Envío (Fábrica Peso & Volumen)</span>
            </span>
          }
          info="Prueba el motor de cálculo con las tarifas guardadas del cantón seleccionado."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.85rem',
              alignItems: 'end',
            }}
          >
            <Select
              label="Cantón destino"
              labelPosition="outlined"
              variant="outline"
              value={simCantonId}
              onChange={(val) => setSimCantonId(val)}
              options={rows.map((r) => ({
                value: r.cantonId,
                label: r.isEnabled ? r.cantonName : `${r.cantonName} (Deshabilitado)`,
              }))}
              fullWidth
            />
            <NumberBox
              label="Peso Real (kg)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              step={0.1}
              value={Number(simWeightKg)}
              onChange={(e) => setSimWeightKg(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Largo (cm)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              value={Number(simLengthCm)}
              onChange={(e) => setSimLengthCm(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Ancho (cm)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              value={Number(simWidthCm)}
              onChange={(e) => setSimWidthCm(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Alto (cm)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              value={Number(simHeightCm)}
              onChange={(e) => setSimHeightCm(e.target.value)}
              fullWidth
            />
            <NumberBox
              label="Subtotal Pedido ($)"
              labelPosition="outlined"
              variant="outline"
              min={0}
              step={0.5}
              value={Number(simSubtotal)}
              onChange={(e) => setSimSubtotal(e.target.value)}
              fullWidth
            />
            <Button
              type="button"
              variant="primary"
              disabled={simBusy || !simCantonId}
              onClick={() => void handleSimulate()}
              iconLeft={<Calculator size={16} />}
            >
              {simBusy ? 'Calculando...' : 'Calcular envío'}
            </Button>
          </div>

          {simResult && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.9rem 1rem',
                borderRadius: 10,
                border: '1px solid var(--shell-border, rgba(0,0,0,0.1))',
                background: 'var(--glb-surface-alt, rgba(0,0,0,0.02))',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Peso Real</div>
                <strong>{simResult.actualWeightKg.toFixed(2)} kg</strong>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  Peso Volumétrico (÷ {simResult.volumetricDivisor})
                </div>
                <strong>{simResult.volumetricWeightKg.toFixed(2)} kg</strong>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Peso Facturable</div>
                <strong>{simResult.chargeableWeightKg.toFixed(2)} kg</strong>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Base + Kg Extra</div>
                <strong>
                  ${simResult.basePrice.toFixed(2)} + ${simResult.extraWeightCost.toFixed(2)} (
                  {simResult.extraWeightKg} kg)
                </strong>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  IVA ({simResult.taxRate}%)
                </div>
                <strong>${simResult.taxAmount.toFixed(2)}</strong>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Total Envío</div>
                <strong style={{ fontSize: '1.1rem', color: 'var(--shell-primary, #2563eb)' }}>
                  {simResult.isFreeShipping ? 'GRATIS ($0.00)' : `$${simResult.totalPrice.toFixed(2)}`}
                </strong>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
