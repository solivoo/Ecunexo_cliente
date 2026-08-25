import { api } from '@/lib/apiClient'
import type {
  CreateDepartmentBody,
  CreateDepartmentResponseDto,
  UpdateDepartmentBody,
  UpdateDepartmentResponseDto,
  CreatePermissionBody,
  CreatePermissionResponseDto,
  CreatePolicyBody,
  CreatePolicyResponseDto,
  CreateRoleBody,
  CreateRoleResponseDto,
  CreateUserBody,
  CreateUserResponseDto,
  DepartmentListItemDto,
  GetTenantRoleDto,
  GetTenantUserDto,
  PermissionDetailDto,
  PermissionListItemDto,
  PolicyListItemDto,
  RoleListItemDto,
  SetUserPasswordBody,
  UpdateUserBody,
  UserListItemDto,
} from '@/types/identityApi'

export async function listTenantUsers(tenantId: string): Promise<UserListItemDto[]> {
  const { data } = await api.get<UserListItemDto[]>(`/api/v1/tenants/${tenantId}/users`)
  return data
}

export async function getTenantUser(tenantId: string, userId: string): Promise<GetTenantUserDto> {
  const { data } = await api.get<GetTenantUserDto>(`/api/v1/tenants/${tenantId}/users/${userId}`)
  return data
}

export async function createTenantUser(
  tenantId: string,
  body: CreateUserBody
): Promise<CreateUserResponseDto> {
  const { data } = await api.post<CreateUserResponseDto>(`/api/v1/tenants/${tenantId}/users`, body)
  return data
}

export async function updateTenantUser(
  tenantId: string,
  userId: string,
  body: UpdateUserBody
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/users/${userId}`, body)
}

export async function setTenantUserDisabled(
  tenantId: string,
  userId: string,
  disabled: boolean
): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/users/${userId}/disabled`, { disabled })
}

export async function setTenantUserPassword(
  tenantId: string,
  userId: string,
  body: SetUserPasswordBody
): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/users/${userId}/password`, body)
}

export async function sendTenantUserPasswordResetEmail(
  tenantId: string,
  userId: string
): Promise<{ userId: string; tenantId: string; email: string }> {
  const { data } = await api.post<{ userId: string; tenantId: string; email: string }>(
    `/api/v1/tenants/${tenantId}/users/${userId}/password/reset-email`
  )
  return data
}

export async function deleteTenantUser(tenantId: string, userId: string): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/users/${userId}`)
}

export async function assignUserRole(
  tenantId: string,
  userId: string,
  roleId: string
): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/users/${userId}/roles`, { roleId })
}

export async function unassignUserRole(
  tenantId: string,
  userId: string,
  roleId: string
): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/users/${userId}/roles/${roleId}`)
}

export async function listTenantRoles(tenantId: string): Promise<RoleListItemDto[]> {
  const { data } = await api.get<RoleListItemDto[]>(`/api/v1/tenants/${tenantId}/roles`)
  return data
}

export async function listTenantDepartments(tenantId: string): Promise<DepartmentListItemDto[]> {
  const { data } = await api.get<DepartmentListItemDto[]>(
    `/api/v1/tenants/${tenantId}/departments`
  )
  return data
}

export async function createTenantDepartment(
  tenantId: string,
  body: CreateDepartmentBody
): Promise<CreateDepartmentResponseDto> {
  const { data } = await api.post<CreateDepartmentResponseDto>(
    `/api/v1/tenants/${tenantId}/departments`,
    body
  )
  return data
}

export async function getTenantDepartment(
  tenantId: string,
  departmentId: string
): Promise<DepartmentListItemDto> {
  const { data } = await api.get<DepartmentListItemDto>(
    `/api/v1/tenants/${tenantId}/departments/${departmentId}`
  )
  return data
}

export async function updateTenantDepartment(
  tenantId: string,
  departmentId: string,
  body: UpdateDepartmentBody
): Promise<UpdateDepartmentResponseDto> {
  const { data } = await api.put<UpdateDepartmentResponseDto>(
    `/api/v1/tenants/${tenantId}/departments/${departmentId}`,
    body
  )
  return data
}

export async function getTenantRole(tenantId: string, roleId: string): Promise<GetTenantRoleDto> {
  const { data } = await api.get<GetTenantRoleDto>(`/api/v1/tenants/${tenantId}/roles/${roleId}`)
  return data
}

export async function createTenantRole(
  tenantId: string,
  body: CreateRoleBody
): Promise<CreateRoleResponseDto> {
  const { data } = await api.post<CreateRoleResponseDto>(`/api/v1/tenants/${tenantId}/roles`, body)
  return data
}

export async function grantRolePermission(
  tenantId: string,
  roleId: string,
  permissionId: string
): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/roles/${roleId}/permissions`, { permissionId })
}

export type ReplaceRolePermissionsResponseDto = {
  tenantId: string
  roleId: string
  granted: number
  revoked: number
  permissionIds: string[]
}

export async function replaceRolePermissions(
  tenantId: string,
  roleId: string,
  permissionIds: string[]
): Promise<ReplaceRolePermissionsResponseDto> {
  const { data } = await api.put<ReplaceRolePermissionsResponseDto>(
    `/api/v1/tenants/${tenantId}/roles/${roleId}/permissions`,
    { permissionIds }
  )
  return data
}

export async function unassignRolePermission(
  tenantId: string,
  roleId: string,
  permissionId: string
): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/roles/${roleId}/permissions/${permissionId}`)
}

export async function listPermissions(): Promise<PermissionListItemDto[]> {
  const { data } = await api.get<PermissionListItemDto[]>('/api/v1/permissions')
  return data
}

export async function getPermission(permissionId: string): Promise<PermissionDetailDto> {
  const { data } = await api.get<PermissionDetailDto>(`/api/v1/permissions/${permissionId}`)
  return data
}

export async function createPermission(
  body: CreatePermissionBody
): Promise<CreatePermissionResponseDto> {
  const { data } = await api.post<CreatePermissionResponseDto>('/api/v1/permissions', body)
  return data
}

export async function listPermissionPolicies(permissionId: string): Promise<PolicyListItemDto[]> {
  const { data } = await api.get<PolicyListItemDto[]>(
    `/api/v1/permissions/${permissionId}/policies`
  )
  return data
}

export async function createPermissionPolicy(
  permissionId: string,
  body: CreatePolicyBody
): Promise<CreatePolicyResponseDto> {
  const { data } = await api.post<CreatePolicyResponseDto>(
    `/api/v1/permissions/${permissionId}/policies`,
    body
  )
  return data
}
