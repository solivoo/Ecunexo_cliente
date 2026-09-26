import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, DataGrid, Popup, TextBox, useToast, type ColumnDef } from 'glubox'
import { CheckCircle2, Copy, Globe, Star, Trash2 } from 'lucide-react'
import {
  EmptyState,
  GridIconButton,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createStorefrontDomain,
  deleteStorefrontDomain,
  listStorefrontDomains,
  setPrimaryStorefrontDomain,
  verifyStorefrontDomain,
} from '@/services/storefrontApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { StorefrontDomainDto } from '@/types/storefrontApi'

type StorefrontDomainRow = StorefrontDomainDto & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('dominio', 'dominios')

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
}

export function StorefrontDomainsPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('ecommerce.storefront.manage')
  const [rows, setRows] = useState<StorefrontDomainDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [domain, setDomain] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<StorefrontDomainDto | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<StorefrontDomainDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setRows(await listStorefrontDomains(tenantId))
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron cargar los dominios de la vitrina.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    if (!canManage) return
    void load()
  }, [canManage, load])

  const verifiedCount = useMemo(() => rows.filter((r) => r.isVerified).length, [rows])
  const primaryDomain = useMemo(() => rows.find((r) => r.isPrimary), [rows])

  const handleCreate = useCallback(async () => {
    if (!tenantId) return
    const normalized = normalizeDomain(domain)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) {
      toast.show({
        title: 'Dominio inválido',
        message: 'Escribe un dominio como tienda.cliente.com (sin http:// ni rutas).',
        variant: 'error',
      })
      return
    }

    setCreating(true)
    try {
      const result = await createStorefrontDomain(tenantId, { domain: normalized })
      setCreateOpen(false)
      setDomain('')
      setCreated(result)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo registrar',
        message: readApiError(err, 'Verifica el dominio e intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setCreating(false)
    }
  }, [domain, load, tenantId, toast])

  const handleVerify = useCallback(
    async (row: StorefrontDomainDto) => {
      if (!tenantId) return
      setBusyId(row.id)
      try {
        const result = await verifyStorefrontDomain(tenantId, row.id)
        if (result.isVerified) {
          toast.show({ title: 'Dominio verificado', message: `${result.domain} ya es público.`, variant: 'success' })
        } else {
          toast.show({
            title: 'Aún sin verificar',
            message: 'El registro TXT no aparece en el DNS. Propaga los cambios y reintenta.',
            variant: 'warning',
          })
        }
        await load()
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo verificar',
          message: readApiError(err, 'Revisa el registro TXT del dominio.'),
          variant: 'error',
        })
      } finally {
        setBusyId(null)
      }
    },
    [load, tenantId, toast]
  )

  const handlePrimary = useCallback(
    async (row: StorefrontDomainDto) => {
      if (!tenantId) return
      setBusyId(row.id)
      try {
        await setPrimaryStorefrontDomain(tenantId, row.id)
        toast.show({ title: 'Dominio principal', message: `${row.domain} es el dominio canónico.`, variant: 'success' })
        await load()
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo marcar',
          message: readApiError(err, 'Solo un dominio verificado puede ser principal.'),
          variant: 'error',
        })
      } finally {
        setBusyId(null)
      }
    },
    [load, tenantId, toast]
  )

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setDeleting(true)
    try {
      await deleteStorefrontDomain(tenantId, confirmDelete.id)
      toast.show({ title: 'Dominio despublicado', message: `${confirmDelete.domain} dejó de mostrar la tienda.`, variant: 'success' })
      setConfirmDelete(null)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo eliminar',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }, [confirmDelete, load, tenantId, toast])

  const copyTxt = useCallback(
    async (row: StorefrontDomainDto) => {
      try {
        await navigator.clipboard.writeText(row.txtRecordValue)
        toast.show({ title: 'Copiado', message: 'Valor TXT copiado al portapapeles.', variant: 'success' })
      } catch {
        toast.show({ title: 'No se pudo copiar', message: row.txtRecordValue, variant: 'warning' })
      }
    },
    [toast]
  )

  const columns = useMemo((): ColumnDef<StorefrontDomainRow>[] => {
    return [
      {
        key: 'domain',
        header: 'Dominio',
        width: 260,
        sortable: true,
        renderCell: (_value, row) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={15} aria-hidden />
            <strong>{row.domain}</strong>
            {row.isPrimary ? <StatusBadge tone="primary">Principal</StatusBadge> : null}
          </span>
        ),
      },
      {
        key: 'isVerified',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_value, row) => (
          <span className={`ecu-status ${row.isVerified ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isVerified ? 'Verificado' : 'Pendiente'}
          </span>
        ),
      },
      {
        key: 'txtRecordName',
        header: 'Registro TXT',
        width: 330,
        sortable: false,
        renderCell: (_value, row) =>
          row.isVerified ? (
            '—'
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <code className="ecu-code">{row.txtRecordName}</code>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <code className="ecu-code">{row.txtRecordValue}</code>
                <GridIconButton label="Copiar valor TXT" icon={Copy} onClick={() => void copyTxt(row)} />
              </span>
            </div>
          ),
      },
      {
        key: 'verifiedAt',
        header: 'Verificado',
        width: 150,
        sortable: true,
        renderCell: (_value, row) => (row.verifiedAt ? formatDateTime(row.verifiedAt) : '—'),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => formatDate(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 150,
        align: 'center',
        sortable: false,
        renderCell: (_value, row) => (
          <div className="ecu-companies-grid__actions">
            {!row.isVerified ? (
              <GridIconButton
                label="Verificar dominio"
                icon={CheckCircle2}
                disabled={busyId === row.id}
                loading={busyId === row.id}
                onClick={() => void handleVerify(row)}
              />
            ) : null}
            {row.isVerified && !row.isPrimary ? (
              <GridIconButton
                label="Marcar como principal"
                icon={Star}
                disabled={busyId === row.id}
                loading={busyId === row.id}
                onClick={() => void handlePrimary(row)}
              />
            ) : null}
            <GridIconButton
              label="Eliminar dominio"
              icon={Trash2}
              danger
              disabled={deleting || busyId === row.id}
              onClick={() => setConfirmDelete(row)}
            />
          </div>
        ),
      },
    ]
  }, [busyId, copyTxt, deleting, handlePrimary, handleVerify])

  if (!canManage) {
    return (
      <TenantSessionGate title="Vitrina y dominios" lead="Publicación de la tienda online por dominio.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso ecommerce.storefront.manage para administrar los dominios de la vitrina."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Vitrina y dominios" lead="Publicación de la tienda online por dominio.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Vitrina y Dominios"
          subtitle="Publica el catálogo de la empresa en su propio dominio con verificación DNS."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de dominios">
          <StatCard label="Dominios" value={rows.length} />
          <StatCard label="Verificados" value={verifiedCount} />
          <StatCard label="Principal" value={primaryDomain?.domain ?? '—'} />
        </div>

        <SectionCard title="Dominios de la vitrina">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState
              icon="globe"
              title="Aún no hay dominios publicados"
              description="Registra el dominio del cliente y verifica el registro TXT para publicar su catálogo."
              action={
                <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                  + Agregar dominio
                </Button>
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as StorefrontDomainRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={240}
              searchPlaceholder="Buscar dominio…"
              searchKeys={['domain']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                    + Agregar dominio
                  </Button>
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              loading={loading}
              messages={gridMessages}
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={createOpen}
        title="Agregar dominio"
        onClose={() => setCreateOpen(false)}
        width="min(92vw, 30rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setCreateOpen(false),
            disabled: creating,
          },
          {
            id: 'confirm',
            label: 'Registrar dominio',
            variant: 'primary',
            onClick: () => void handleCreate(),
            disabled: creating || domain.trim().length === 0,
          },
        ]}
      >
        <TextBox
          id="storefront-domain"
          label="Dominio del cliente"
          labelPosition="outlined"
          variant="outline"
          value={domain}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
          placeholder="tienda.cliente.com"
          disabled={creating}
          fullWidth
        />
      </Popup>

      <Popup
        open={created !== null}
        title="Verifica el dominio"
        onClose={() => setCreated(null)}
        width="min(92vw, 34rem)"
        actions={[
          {
            id: 'close',
            label: 'Entendido',
            variant: 'primary',
            onClick: () => setCreated(null),
          },
        ]}
      >
        {created ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p className="app-shell__muted">
              Crea un registro <strong>TXT</strong> en el DNS de <strong>{created.domain}</strong> con estos
              valores y luego usa «Verificar».
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span className="ecu-code">{created.txtRecordName}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <code className="ecu-code">{created.txtRecordValue}</code>
                <GridIconButton
                  label="Copiar valor TXT"
                  icon={Copy}
                  onClick={() => void copyTxt(created)}
                />
              </span>
            </div>
          </div>
        ) : null}
      </Popup>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar dominio"
        onClose={() => setConfirmDelete(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(null),
            disabled: deleting,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => void handleDelete(),
            disabled: deleting,
          },
        ]}
      >
        {confirmDelete ? (
          <p className="app-shell__muted">
            ¿Despublicar <strong>{confirmDelete.domain}</strong>? La tienda dejará de mostrarse en ese
            dominio de inmediato.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
