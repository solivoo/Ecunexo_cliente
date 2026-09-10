import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { createWarehouse } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function CreateWarehousePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage =
    useHasPermission('warehousing.locations.manage') || useHasPermission('warehousing.warehouse.manage')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

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
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la bodega es obligatorio.')
        await createWarehouse(tenantId, { name: name.trim(), code: code.trim() || null })
        toast.show({
          title: 'Bodega creada',
          message: `«${name.trim()}» ya está disponible para el stock.`,
          variant: 'success',
        })
        void navigate('/bodegas', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear la bodega.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [code, name, navigate, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Nueva bodega" lead="Alta de una ubicación de stock.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres warehousing.locations.manage para dar de alta nuevas ubicaciones."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees las autorizaciones necesarias para crear bodegas en esta empresa.
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
    <TenantSessionGate title="Nueva bodega" lead="Alta de una ubicación operativa de stock.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nueva Bodega"
          subtitle="Alta de una ubicación física operativa para el almacenamiento y despacho de productos."
          badge={
            <StatusBadge tone="primary" withDot>
              Nueva Ubicación
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de crear bodega"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title="Datos de la Bodega"
            subtitle="Especifica el nombre comercial y código interno de control. Las bodegas en tránsito se gestionan automáticamente por el sistema."
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
                  placeholder="Ej. Bodega Central, Depósito Norte"
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="wh-code"
                  label="Código identificador (opcional)"
                  labelPosition="outlined"
                  variant="outline"
                  value={code}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                  placeholder="BOD-01"
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
                Guardar Bodega
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
