import { api } from '@/lib/apiClient'
import type {
  CreateCustomerPayload,
  CustomerDto,
  CustomerFilterParams,
  UpdateCustomerPayload,
} from '@/types/customersApi'

/**
 * Listar clientes del tenant con filtros opcionales por tipo, búsqueda o rango de fechas.
 */
export async function listCustomers(
  tenantId: string,
  params?: CustomerFilterParams
): Promise<CustomerDto[]> {
  const queryParams: Record<string, string> = {}
  if (params?.type !== undefined) {
    queryParams.type = String(params.type)
  }
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }

  const { data } = await api.get<CustomerDto[]>(
    `/api/v1/tenants/${tenantId}/customers`,
    { params: queryParams }
  )
  return data
}

/**
 * Obtener un cliente específico por ID.
 */
export async function getCustomerById(
  tenantId: string,
  customerId: string
): Promise<CustomerDto> {
  const { data } = await api.get<CustomerDto>(
    `/api/v1/tenants/${tenantId}/customers/${customerId}`
  )
  return data
}

/**
 * Crear un nuevo cliente en el directorio comercial.
 */
export async function createCustomer(
  tenantId: string,
  payload: CreateCustomerPayload
): Promise<CustomerDto> {
  const { data } = await api.post<CustomerDto>(
    `/api/v1/tenants/${tenantId}/customers`,
    payload
  )
  return data
}

/**
 * Actualizar los datos de un cliente existente.
 */
export async function updateCustomer(
  tenantId: string,
  customerId: string,
  payload: UpdateCustomerPayload
): Promise<CustomerDto> {
  const { data } = await api.put<CustomerDto>(
    `/api/v1/tenants/${tenantId}/customers/${customerId}`,
    payload
  )
  return data
}

/**
 * Activar o desactivar un cliente en el directorio.
 */
export async function toggleCustomerStatus(
  tenantId: string,
  customerId: string,
  isActive: boolean
): Promise<CustomerDto> {
  const { data } = await api.patch<CustomerDto>(
    `/api/v1/tenants/${tenantId}/customers/${customerId}/status`,
    { isActive }
  )
  return data
}
