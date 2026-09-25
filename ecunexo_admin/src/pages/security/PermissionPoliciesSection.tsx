import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Select, TextBox, useToast } from 'glubox'
import { EmptyState } from '@/components/ui'
import { readApiError } from '@/lib/readApiError'
import { PoliciesGrid } from '@/pages/security/PoliciesGrid'
import { createPermissionPolicy } from '@/services/identityApi'
import type { PolicyListItemDto } from '@/types/identityApi'

const effectOptions = [
  { value: '0', label: 'Permitir si se cumple' },
  { value: '1', label: 'Denegar si se cumple' },
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
          title="Sin políticas condicionales"
          description="El permiso opera solo con RBAC. Agrega una regla para evaluar contexto en tiempo de ejecución."
        />
      ) : (
        <PoliciesGrid rows={policies} loading={loading} />
      )}

      <form
        className="ecu-companies-form ecu-policies-form"
        onSubmit={(e) => void handleCreate(e)}
        noValidate
      >
        <h3 className="ecu-policies-form__title">Nueva política ABAC</h3>

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
              placeholder='Escriba aquí… ej. ctx.Department == "Ventas"'
              disabled={saving}
              fullWidth
            />
          </div>
        </div>

        <div className="ecu-companies-form__actions">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            Guardar política
          </Button>
        </div>
      </form>
    </div>
  )
}
