export type AccountTypeKind = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
export type AccountNatureKind = 'Debit' | 'Credit'

export interface AccountDto {
  id: string
  tenantId: string
  code: string
  name: string
  type: AccountTypeKind
  typeId: number
  nature: AccountNatureKind
  natureId: number
  level: number
  parentAccountId?: string | null
  parentCode?: string | null
  allowsMovement: boolean
  isSystem: boolean
  isActive: boolean
  description?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface CreateAccountPayload {
  code: string
  name: string
  accountType?: number
  nature?: number
  parentAccountId?: string | null
  parentCode?: string | null
  allowsMovement?: boolean
  description?: string | null
}

export interface UpdateAccountPayload {
  name: string
  description?: string | null
  allowsMovement: boolean
  isActive: boolean
  nature?: number
}

export interface AccountFilterParams {
  type?: number
  allowsMovementOnly?: boolean
  activeOnly?: boolean
  search?: string
}

export const ACCOUNT_TYPES: { id: number; name: string; prefix: string; label: string }[] = [
  { id: 1, name: 'Asset', prefix: '1', label: '1. Activo' },
  { id: 2, name: 'Liability', prefix: '2', label: '2. Pasivo' },
  { id: 3, name: 'Equity', prefix: '3', label: '3. Patrimonio' },
  { id: 4, name: 'Revenue', prefix: '4', label: '4. Ingresos' },
  { id: 5, name: 'Expense', prefix: '5', label: '5. Costos y Gastos' },
]

export const ACCOUNT_NATURES: { id: number; name: string; label: string }[] = [
  { id: 1, name: 'Debit', label: 'Deudora (Al Debe)' },
  { id: 2, name: 'Credit', label: 'Acreedora (Al Haber)' },
]
