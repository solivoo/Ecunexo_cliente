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
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.category.manage para crear categorías en la empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No cuentas con los privilegios requeridos para gestionar la estructura de categorías.
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
    <TenantSessionGate title="Nueva categoría" lead="Alta de una clasificación del catálogo.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nueva Categoría"
          subtitle="Crea una categoría para estructurar productos y servicios, y definir moldes de atributos personalizados dinámicos."
          badge={
            <StatusBadge tone="primary" withDot>
              Nueva Categoría
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de crear categoría"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title="Definición de la Categoría"
            subtitle="Nombre comercial, notas explicativas y configuración de campos específicos"
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
                  id="cc-name"
                  label="Nombre de la categoría"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Ej. Ropa y Calzado, Servicios Profesionales"
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="cc-desc"
                  label="Descripción funcional"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Alcance y detalle de esta clasificación…"
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
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Guardar Categoría
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
