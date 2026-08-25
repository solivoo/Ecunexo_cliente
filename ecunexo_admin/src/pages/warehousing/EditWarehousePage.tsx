import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Warehouse } from 'lucide-react'
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
        <p className="app-shell__page-lead">Requieres warehousing.locations.manage.</p>
        <Button type="button" variant="outline" onClick={goToList}>
          Volver
        </Button>
      </TenantSessionGate>
    )
  }

  if (warehouse?.isSystem) {
    return (
      <TenantSessionGate title="Editar bodega" lead="Las bodegas de sistema no se editan.">
        <p className="app-shell__page-lead">
          «{warehouse.name}» es de sistema (tránsito). El stock en tránsito no se renombra: así las
          transferencias siguen un mismo proceso en todos los tenants.
        </p>
        <Button type="button" variant="outline" onClick={goToList}>
          Volver al listado
        </Button>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Editar bodega" lead="Corrige nombre, código y dirección. El stock no se mueve.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Cambiar el nombre no crea otra bodega: el kárdex y el saldo siguen ligados a este id.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de editar bodega"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>
        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="app-shell__muted">Cargando bodega…</p>
        ) : (
          <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <Warehouse size={18} strokeWidth={1.75} aria-hidden /> Ficha
              </h2>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="wh-name"
                    label="Nombre"
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
                    label="Dirección"
                    labelPosition="outlined"
                    variant="outline"
                    value={line1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setLine1(e.target.value)}
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
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-4">
                  <TextBox
                    id="wh-notes"
                    label="Notas de ubicación"
                    labelPosition="outlined"
                    variant="outline"
                    value={notes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>
            </section>
            <div className="ecu-companies-form__actions">
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Guardar
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Atrás
              </Button>
            </div>
          </form>
        )}
      </div>
    </TenantSessionGate>
  )
}
