/** Contratos Identity v1 (camelCase). */

export type UserListItemDto = {
  id: string
  email: string
  name: string
  department: string | null
  phone: string | null
  jobTitle: string | null
  lastLoginAt: string | null
  createdAt: string
  isDisabled: boolean
}

export type GetTenantUserDto = {
  id: string
  email: string
  name: string
  department: string | null
  departmentId: string | null
  phone: string | null
  jobTitle: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string | null
  isDisabled: boolean
  roleIds: string[]
  effectivePermissionCodes: string[]
  /** Admin raíz: correo del titular de la suscripción. No se le cambia el rol. */
  isCompanyOwner: boolean
}

export type CreateUserBody = {
  email: string
  name: string
  password: string
  departmentId?: string | null
  department?: string | null
  phone?: string | null
  jobTitle?: string | null
}

export type SetUserPasswordBody = {
  password: string
}

export type UpdateUserBody = {
  name: string
  email?: string | null
  departmentId?: string | null
  department?: string | null
  phone?: string | null
  jobTitle?: string | null
}

export type DepartmentListItemDto = {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export type CreateDepartmentBody = {
  name: string
  description?: string | null
}

export type CreateDepartmentResponseDto = { departmentId: string; tenantId: string }

export type UpdateDepartmentBody = {
  name: string
  description?: string | null
}

export type UpdateDepartmentResponseDto = { departmentId: string; tenantId: string }

export type CreateUserResponseDto = { userId: string; tenantId: string }

export type RoleListItemDto = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
}

export type GetTenantRoleDto = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string | null
  permissionIds: string[]
}

export type CreateRoleBody = {
  name: string
  description?: string | null
  isSystem?: boolean
}

export type CreateRoleResponseDto = { roleId: string; tenantId: string }

export type UpdateRoleBody = {
  name: string
  description?: string | null
}

export type UpdateRoleResponseDto = { roleId: string; tenantId: string }

export type DeleteRoleResponseDto = { roleId: string; tenantId: string }

export type DeleteDepartmentResponseDto = { departmentId: string; tenantId: string }

export type PermissionListItemDto = {
  id: string
  code: string
  displayName: string | null
  module: string | null
  sortOrder: number
  description: string | null
  status: number
  createdAt: string
}

export type PermissionDetailDto = {
  id: string
  code: string
  displayName: string | null
  module: string | null
  sortOrder: number
  description: string | null
  status: number
  createdAt: string
  updatedAt: string | null
}

export type PolicyListItemDto = {
  id: string
  effect: number
  condition: string | null
  createdAt: string
}

export type CreatePermissionBody = {
  code: string
  description?: string | null
  displayName?: string | null
  module?: string | null
  sortOrder?: number
}

export type CreatePermissionResponseDto = { permissionId: string }

export type CreatePolicyBody = {
  effect: number
  condition?: string | null
}

export type CreatePolicyResponseDto = { policyId: string; permissionId: string }
