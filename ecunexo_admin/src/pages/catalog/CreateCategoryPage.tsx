import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { FolderTree } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { serializeAttributeSchema } from '@/lib/catalogAttributes'
import { readApiError } from '@/lib/readApiError'
import {
  CategoryAttributeSchemaEditor,
  type CategoryAttributeDraft,
} from '@/pages/catalog/CategoryAttributeSchemaEditor'
import { createCatalogCategory } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function CreateCategoryPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('catalog.category.manage')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [attributeFields, setAttributeFields] = useState<CategoryAttributeDraft[]>([])

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
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la categoría es obligatorio.')

        const incomplete = attributeFields.some((f) => !(f.label ?? '').trim())
        if (incomplete) {
          throw new Error('Completa el nombre de cada campo adicional o quítalo.')
        }

        await createCatalogCategory(tenantId, {
          name: name.trim(),
          description: description.trim() || null,
          attributeSchemaJson: serializeAttributeSchema(attributeFields),
        })

        toast.show({
          title: 'Categoría creada',
          message: `«${name.trim()}» ya está disponible para los ítems.`,
          variant: 'success',
        })
        void navigate('/catalogo/categorias', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : readApiError(err, 'No se pudo crear la categoría.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [attributeFields, description, name, navigate, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Nueva categoría" lead="Alta de una clasificación del catálogo.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres catalog.category.manage para crear categorías.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nueva categoría" lead="Alta de una clasificación del catálogo.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Agrupa ítems (productos o servicios) y define campos extra si los necesitas.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de crear categoría"
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
              <FolderTree size={18} strokeWidth={1.75} aria-hidden /> Categoría
            </h2>
            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="cc-name"
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
                  id="cc-desc"
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
      </div>
    </TenantSessionGate>
  )
}
