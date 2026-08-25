import { OptionGroup, Select } from 'glubox'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import type { AssignmentFilter } from '@/pages/team/useRolePermissionsEditor'

type ModuleOption = { value: string; label: string }

type RolePermissionsFiltersProps = {
  readonly moduleFilter: string
  readonly onModuleChange: (value: string) => void
  readonly moduleOptions: ModuleOption[]
  readonly assignmentFilter: AssignmentFilter
  readonly onAssignmentChange: (value: AssignmentFilter) => void
  readonly disabled?: boolean
}

const ASSIGNMENT_OPTIONS: { value: AssignmentFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'assigned', label: 'Marcados' },
  { value: 'unassigned', label: 'Sin marcar' },
]

function toAssignmentFilter(value: string): AssignmentFilter | null {
  if (value === 'all' || value === 'assigned' || value === 'unassigned') return value
  return null
}

export function RolePermissionsFilters({
  moduleFilter,
  onModuleChange,
  moduleOptions,
  assignmentFilter,
  onAssignmentChange,
  disabled = false,
}: RolePermissionsFiltersProps) {
  const size = useGluComponentSize()

  return (
    <>
      <Select
        id="role-perms-module"
        aria-label="Módulo"
        variant="outline"
        options={moduleOptions}
        value={moduleFilter}
        onChange={onModuleChange}
        placeholder="Módulo"
        disabled={disabled}
        width="15rem"
        size={size}
      />
      <div role="group" aria-label="Asignación">
        <OptionGroup
          id="role-perms-assignment"
          name="role-perms-assignment"
          options={ASSIGNMENT_OPTIONS}
          value={assignmentFilter}
          onChange={(value: string) => {
            const next = toAssignmentFilter(value)
            if (next) onAssignmentChange(next)
          }}
          layout="segmented"
          variant="outline"
          disabled={disabled}
          size={size}
        />
      </div>
    </>
  )
}
