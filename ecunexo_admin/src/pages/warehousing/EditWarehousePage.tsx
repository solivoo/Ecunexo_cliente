import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { getWarehouse, updateWarehouse } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { WarehouseDetailDto } from '@/types/inventoryApi'

function parseAddress(raw: string): { line1: string; city: string; notes: string } {
  try {
    const parsed: unknown = JSON.parse(raw || '{}')
    if (!parsed || typeof parsed !== 'object') {
      return { line1: '', city: '', notes: '' }
    }
    const rec = parsed as Record<string, unknown>
    return {
      line1: typeof rec.line1 === 'string' ? rec.line1 : '',
      city: typeof rec.city === 'string' ? rec.city : '',
      notes: typeof rec.notes === 'string' ? rec.notes : '',
    }
  } catch {
    return { line1: '', city: '', notes: '' }
  }
}

export function EditWarehousePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { warehouseId } = useParams<{ warehouseId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canManage =
    useHasPermission('warehousing.locations.manage') || useHasPermission('warehousing.warehouse.manage')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warehouse, setWarehouse] = useState<WarehouseDetailDto | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!tenantId || !warehouseId || !canManage) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const detail = await getWarehouse(tenantId, warehouseId)
        if (cancelled) return
        setWarehouse(detail)
        setName(detail.name)
        setCode(detail.code ?? '')
        const address = parseAddress(detail.addressJson)
        setLine1(address.line1)
        setCity(address.city)
        setNotes(address.notes)
        setError(null)
      } catch (err: unknown) {
        if (!cancelled) setError(readApiError(err, 'No se pudo cargar la bodega.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canManage, tenantId, warehouseId])

  const goToList = useCallback(() => {
    void navigate('/bodegas')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [{ id: 'list', label: 'Listado de bodegas', icon: 'warehouse', route: '/bodegas', disabled: false }],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !warehouseId || !warehouse) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la bodega es obligatorio.')
        await updateWarehouse(tenantId, warehouseId, {
          name: name.trim(),
          code: code.trim() || null,
          addressLine1: line1.trim() || null,
          city: city.trim() || null,
          notes: notes.trim() || null,
        })
        toast.show({
          title: 'Bodega actualizada',
          message: `«${name.trim()}» quedó con el nombre y la dirección corregidos.`,
          variant: 'success',
        })
        void navigate('/bodegas', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar la bodega.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [city, code, line1, name, navigate, notes, tenantId, toast, warehouse, warehouseId]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Editar bodega" lead="Corrige la ficha de una ubicación operativa.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres warehousing.locations.manage para editar bodegas."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees permisos de gestión sobre las ubicaciones de almacenamiento.
            </p>
            <Button type="button" variant="outline" onClick={goToList}>
              Volver al listado
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  if (warehouse?.isSystem) {
    return (
      <TenantSessionGate title="Editar bodega" lead="Las bodegas de sistema no se editan.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Bodega de Sistema"
            subtitle={`«${warehouse.name}» es una ubicación reservada para transferencias de stock en tránsito.`}
            badge={<StatusBadge tone="warning">Protegida</StatusBadge>}
          />
          <SectionCard title="Ubicación no modificable">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              Las bodegas de sistema son esenciales para garantizar la trazabilidad de kárdex entre sucursales y no admiten modificaciones manuales de nombre o código.
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
    <TenantSessionGate title="Editar bodega" lead="Corrige nombre, código y dirección. El stock no se mueve.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={warehouse ? `Editar: ${warehouse.name}` : 'Editar Bodega'}
          subtitle={
            warehouse
              ? `${warehouse.code ? `Código: ${warehouse.code} · ` : ''}${warehouse.isMain ? 'Bodega Principal de la Empresa' : 'Bodega Operativa'}`
              : 'Cargando información de la bodega…'
          }
          badge={
            warehouse ? (
              <StatusBadge
                tone={warehouse.isMain ? 'success' : 'info'}
                withDot={warehouse.isMain}
              >
                {warehouse.isMain ? 'Principal' : 'Operativa'}
              </StatusBadge>
            ) : undefined
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de editar bodega"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        {loading ? (
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Recuperando detalles de la bodega…</p>
          </SectionCard>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} noValidate>
            <SectionCard
              title="Ficha Técnica de la Bodega"
              subtitle="Corrige los datos de identificación y localización física sin alterar el historial de movimientos de kárdex"
            >
              {error ? (
                <div className="ecu-form-error-banner" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="wh-name"
                    label="Nombre de la bodega"
                    labelPosition="outlined"
                    variant="outline"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="wh-code"
                    label="Código"
                    labelPosition="outlined"
                    variant="outline"
                    value={code}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="wh-line1"
                    label="Dirección física"
                    labelPosition="outlined"
                    variant="outline"
                    value={line1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setLine1(e.target.value)}
                    placeholder="Av. Principal #123"
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="wh-city"
                    label="Ciudad"
                    labelPosition="outlined"
                    variant="outline"
                    value={city}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                    placeholder="Quito, Guayaquil, Cuenca…"
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-4">
                  <TextBox
                    id="wh-notes"
                    label="Notas de ubicación o referencia"
                    labelPosition="outlined"
                    variant="outline"
                    value={notes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    placeholder="Referencias de acceso, horarios o encargado de bodega…"
                    disabled={busy}
                    fullWidth
                  />
                </div>
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
                  Guardar Cambios
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                  Cancelar
                </Button>
              </div>
            </SectionCard>
          </form>
        )}
      </div>
    </TenantSessionGate>
  )
}
