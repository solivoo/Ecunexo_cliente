import type { ChangeEvent } from 'react'
import { Button, CheckButton, Select, TextBox } from 'glubox'
import { Plus, Trash2 } from 'lucide-react'
import type { CatalogAttributeField } from '@/types/catalogApi'
import './categoryAttributeSchemaEditor.css'

export type CategoryAttributeDraft = CatalogAttributeField & {
  readonly rowId: string
}

const TYPE_OPTIONS = [
  { value: 'string', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'color', label: 'Color (varios)' },
]

function newRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attr-${Date.now()}-${Math.random()}`
}

export function createEmptyAttributeDraft(): CategoryAttributeDraft {
  return {
    rowId: newRowId(),
    key: '',
    label: '',
    type: 'string',
    required: false,
  }
}

export type CategoryAttributeSchemaEditorProps = {
  readonly fields: readonly CategoryAttributeDraft[]
  readonly disabled?: boolean
  readonly onChange: (next: CategoryAttributeDraft[]) => void
}

export function CategoryAttributeSchemaEditor({
  fields,
  disabled = false,
  onChange,
}: CategoryAttributeSchemaEditorProps) {
  const patchRow = (rowId: string, patch: Partial<CategoryAttributeDraft>) => {
    onChange(fields.map((f) => (f.rowId === rowId ? { ...f, ...patch } : f)))
  }

  const removeRow = (rowId: string) => {
    onChange(fields.filter((f) => f.rowId !== rowId))
  }

  const addField = () => onChange([...fields, createEmptyAttributeDraft()])

  return (
    <div className="cat-attr-schema">
      <div className="cat-attr-schema__head">
        <h3 className="cat-attr-schema__title">Campos adicionales</h3>
        <p className="cat-attr-schema__hint">
          Opcional. Al crear un ítem se pedirán estos datos. Tipo Color (varios) abre un
          picker y permite más de un color.
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="cat-attr-schema__empty">Sin campos extra. Solo nombre y datos básicos del ítem.</p>
      ) : (
        <ul className="cat-attr-schema__list">
          {fields.map((field, index) => (
            <li key={field.rowId} className="cat-attr-schema__row">
              <div className="cat-attr-schema__field cat-attr-schema__field--label">
                <TextBox
                  id={`cat-attr-label-${field.rowId}`}
                  label={`Campo ${index + 1}`}
                  labelPosition="top"
                  variant="outline"
                  placeholder="Ej. Duración (min)"
                  value={field.label ?? ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    patchRow(field.rowId, { label: e.target.value })
                  }
                  disabled={disabled}
                  fullWidth
                />
              </div>
              <div className="cat-attr-schema__field cat-attr-schema__field--type">
                <Select
                  id={`cat-attr-type-${field.rowId}`}
                  label="Tipo"
                  labelPosition="top"
                  variant="outline"
                  options={TYPE_OPTIONS}
                  value={
                    field.type === 'number' || field.type === 'boolean' || field.type === 'color'
                      ? field.type
                      : 'string'
                  }
                  onChange={(value) => patchRow(field.rowId, { type: value })}
                  disabled={disabled}
                  fullWidth
                />
              </div>
              <div className="cat-attr-schema__field cat-attr-schema__field--req">
                <CheckButton
                  variant="ghost"
                  checked={field.required === true}
                  disabled={disabled}
                  onChange={(checked: boolean) => patchRow(field.rowId, { required: checked })}
                >
                  Obligatorio
                </CheckButton>
              </div>
              <div className="cat-attr-schema__field cat-attr-schema__field--actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Quitar campo ${index + 1}`}
                  onClick={() => removeRow(field.rowId)}
                >
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="cat-attr-schema__foot">
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={addField}>
          <Plus size={15} strokeWidth={2} aria-hidden />
          Agregar campo
        </Button>
      </div>
    </div>
  )
}
