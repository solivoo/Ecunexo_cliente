import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Warehouse } from 'lucide-react'
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
          message: `«${name.trim()}» ya está disponible.`,
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
        <p className="app-shell__page-lead">Requieres warehousing.locations.manage.</p>
        <Button type="button" variant="outline" onClick={goToList}>
          Volver
        </Button>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nueva bodega" lead="Alta de una ubicación operativa (no de tránsito).">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">La bodega en tránsito no se crea desde aquí: es de sistema.</p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de crear bodega"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>
        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <section className="app-shell__card ecu-companies-form__card">
            <h2 className="app-shell__section-title">
              <Warehouse size={18} strokeWidth={1.75} aria-hidden /> Bodega
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
      </div>
    </TenantSessionGate>
  )
}
