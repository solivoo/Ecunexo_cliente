import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { parseAttributeSchema, serializeAttributeSchema } from '@/lib/catalogAttributes'
import { readApiError } from '@/lib/readApiError'
import {
  CategoryAttributeSchemaEditor,
  createEmptyAttributeDraft,
  type CategoryAttributeDraft,
} from '@/pages/catalog/CategoryAttributeSchemaEditor'
import { listCatalogCategories, softDeleteCatalogCategory, updateCatalogCategory } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function EditCategoryPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { categoryId } = useParams<{ categoryId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('catalog.category.manage')

  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [attributeFields, setAttributeFields] = useState<CategoryAttributeDraft[]>([])

  useEffect(() => {
    if (!tenantId || !categoryId || !canManage) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const rows = await listCatalogCategories(tenantId)
        const row = rows.find((c) => c.id === categoryId)
        if (!row) throw new Error('La categoría no existe o fue eliminada.')
        if (cancelled) return
        setName(row.name)
        setDescription(row.description ?? '')
        setAttributeFields(
          parseAttributeSchema(row.attributeSchemaJson).map((field) => ({
            ...createEmptyAttributeDraft(),
            ...field,
            rowId: globalThis.crypto?.randomUUID?.() ?? `attr-${field.key}`,
          }))
        )
        setError(null)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiError(err, 'No se pudo cargar la categoría.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canManage, categoryId, tenantId])

  const goToList = useCallback(() => {
    void navigate('/catalogo/categorias')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de categorías',
        icon: 'folder-tree',
        route: '/catalogo/categorias',
        disabled: false,
      },
      {
        id: 'items',
        label: 'Ítems',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
    ],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !categoryId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la categoría es obligatorio.')

        const incomplete = attributeFields.some((f) => !(f.label ?? '').trim())
        if (incomplete) {
          throw new Error('Completa el nombre de cada campo adicional o quítalo.')
        }

        await updateCatalogCategory(tenantId, categoryId, {
          name: name.trim(),
          description: description.trim() || null,
          attributeSchemaJson: serializeAttributeSchema(attributeFields),
        })

        toast.show({
          title: 'Categoría actualizada',
          message: `«${name.trim()}» guardada correctamente.`,
          variant: 'success',
        })
        void navigate('/catalogo/categorias', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : readApiError(err, 'No se pudo actualizar la categoría.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [attributeFields, categoryId, description, name, navigate, tenantId, toast]
  )

  const onDelete = useCallback(async () => {
    if (!tenantId || !categoryId || !canManage) return

    setDeleting(true)
    setError(null)
    try {
      await softDeleteCatalogCategory(tenantId, categoryId)
      toast.show({
        title: 'Categoría eliminada',
        message: `«${name.trim()}» quedó dada de baja.`,
        variant: 'success',
      })
      setConfirmDelete(false)
      void navigate('/catalogo/categorias', { replace: true })
    } catch (err: unknown) {
      const message = readApiError(
        err,
        'La categoría tiene ítems o subcategorías. Reasigna o edítala.'
      )
      setError(message)
      toast.show({ title: 'No se pudo eliminar', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [canManage, categoryId, name, navigate, tenantId, toast])

  if (!canManage) {
    return (
      <TenantSessionGate title="Editar categoría" lead="Modificar clasificación del catálogo.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.category.manage para editar categorías en la empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No dispones de autorizaciones para editar clasificaciones del catálogo.
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
    <TenantSessionGate title="Editar categoría" lead="Modificar clasificación del catálogo.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={name.trim() ? `Editar: ${name}` : 'Editar Categoría'}
          subtitle="Modifica la denominación, descripción o el molde de campos dinámicos para los ítems pertenecientes a esta categoría."
          badge={
            <StatusBadge tone="primary" withDot>
              Categoría
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de editar categoría"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        {loading ? (
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Recuperando detalles de la categoría…</p>
          </SectionCard>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} noValidate>
            <SectionCard
              title="Ficha de la Categoría"
              subtitle="Parámetros descriptivos y molde de campos dinámicos (atributos personalizados)"
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
                    id="ec-name"
                    label="Nombre de la categoría"
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
                    id="ec-desc"
                    label="Descripción funcional"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <CategoryAttributeSchemaEditor
                  fields={attributeFields}
                  disabled={busy}
                  onChange={setAttributeFields}
                />
              </div>

              <div
                className="ecu-companies-form__actions"
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <Button type="submit" variant="primary" loading={busy} disabled={busy || deleting}>
                  Guardar Cambios
                </Button>
                {canManage ? (
                  <Button
                    type="button"
                    variant="danger"
                    loading={deleting}
                    disabled={busy || deleting}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || deleting}
                  onClick={goToList}
                >
                  Cancelar
                </Button>
              </div>
            </SectionCard>
          </form>
        )}
      </div>

      <Popup
        open={confirmDelete}
        title="Eliminar categoría"
        onClose={() => setConfirmDelete(false)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(false),
            disabled: deleting,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void onDelete()
            },
            disabled: deleting,
          },
        ]}
      >
        <p className="app-shell__muted">
          ¿Dar de baja <strong>{name.trim() || 'esta categoría'}</strong>? Solo se permite si no
          tiene ítems ni subcategorías asociadas. Es una baja lógica.
        </p>
      </Popup>
    </TenantSessionGate>
  )
}
