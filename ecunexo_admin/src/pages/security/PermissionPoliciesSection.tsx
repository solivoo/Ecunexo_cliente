import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Select, TextBox, useToast } from 'glubox'
import { EmptyState } from '@/components/ui'
import { readApiError } from '@/lib/readApiError'
import { PoliciesGrid } from '@/pages/security/PoliciesGrid'
import { createPermissionPolicy } from '@/services/identityApi'
import type { PolicyListItemDto } from '@/types/identityApi'

const effectOptions = [
  { value: '0', label: 'Allow — permitir si se cumple la condición' },
  { value: '1', label: 'Deny — denegar si se cumple la condición' },
]

type PermissionPoliciesSectionProps = {
  readonly permissionId: string
  readonly policies: PolicyListItemDto[]
  readonly loading: boolean
  readonly canManage: boolean
  readonly onCreated: () => Promise<void>
}

export function PermissionPoliciesSection({
  permissionId,
  policies,
  loading,
  canManage,
  onCreated,
}: PermissionPoliciesSectionProps) {
  const toast = useToast()
  const [effect, setEffect] = useState('0')
  const [condition, setCondition] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      setSaving(true)
      setFormError(null)
      try {
        await createPermissionPolicy(permissionId, {
          effect: Number(effect),
          condition: condition.trim() || null,
        })
        setCondition('')
        setEffect('0')
        toast.show({
          title: 'Política creada',
          message: 'La regla ABAC quedó asociada a este permiso.',
          variant: 'success',
        })
        await onCreated()
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo crear la política.')
        setFormError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setSaving(false)
      }
    },
    [condition, effect, onCreated, permissionId, toast]
  )

  if (!canManage) {
    return (
      <p className="app-shell__muted">
        Requieres identity.policies.manage para ver o crear políticas.
      </p>
    )
  }

  return (
    <div>
      {policies.length === 0 ? (
        <EmptyState
          icon="policy"
          title="Sin políticas condicionales ABAC"
          description="Este permiso opera bajo autorización RBAC tradicional. Agrega una regla condicional abajo para evaluar atributos de contexto en tiempo de ejecución (ej. ctx.Department == 'Ventas')."
        />
      ) : (
        <PoliciesGrid rows={policies} loading={loading} />
      )}

      <form
        className="ecu-companies-form"
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
        }}
        onSubmit={(e) => void handleCreate(e)}
        noValidate
      >
        <div>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--glb-text)',
              marginBottom: '0.25rem',
            }}
          >
            Nueva política ABAC
          </h3>
          <p
            className="app-shell__muted"
            style={{ marginBottom: '1rem', fontSize: '0.85rem' }}
          >
            Allow = conceder si la condición es verdadera. Deny = rechazar si es verdadera. Condición vacía = regla fija. Variable disponible: <code>ctx</code>.
          </p>
        </div>

        {formError ? (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{formError}</span>
          </div>
        ) : null}

        <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
          <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
            <Select
              id="pol-effect"
              label="Efecto"
              labelPosition="outlined"
              variant="outline"
              options={effectOptions}
              value={effect}
              onChange={setEffect}
              disabled={saving}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
            <TextBox
              id="pol-cond"
              label="Condición (opcional)"
              labelPosition="outlined"
              variant="outline"
              value={condition}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCondition(e.target.value)}
              placeholder='ctx.Department == "Ventas"'
              disabled={saving}
              fullWidth
            />
          </div>
        </div>

        <div className="ecu-companies-form__actions" style={{ marginTop: '1rem' }}>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            Guardar política
          </Button>
        </div>
      </form>
    </div>
  )
}
