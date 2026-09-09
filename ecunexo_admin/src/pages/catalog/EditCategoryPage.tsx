import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { FolderTree } from 'lucide-react'
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
import { listCatalogCategories, updateCatalogCategory } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function EditCategoryPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { categoryId } = useParams<{ categoryId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('catalog.category.manage')

  const [busy, setBusy] = useState(false)
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
          message: `«${name.trim()}» guardada.`,
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

  if (!canManage) {
    return (
      <TenantSessionGate title="Editar categoría" lead="Modificar clasificación del catálogo.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres catalog.category.manage para editar categorías.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Editar categoría" lead="Modificar clasificación del catálogo.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Cambia el nombre, la descripción o el molde de atributos.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de editar categoría"
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
          <p className="app-shell__muted">Cargando…</p>
        ) : (
          <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <FolderTree size={18} strokeWidth={1.75} aria-hidden /> Categoría
              </h2>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="ec-name"
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
                    id="ec-desc"
                    label="Descripción"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>

              <CategoryAttributeSchemaEditor
                fields={attributeFields}
                disabled={busy}
                onChange={setAttributeFields}
              />
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
