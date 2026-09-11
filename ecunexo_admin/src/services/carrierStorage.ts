export type TransportCarrier = {
  id: string
  name: string
  document: string
  vehiclePlate: string
  phone?: string
  notes?: string
  isDefault?: boolean
}

const STORAGE_PREFIX = 'ecunexo_carriers_'

export function getTenantCarriers(tenantId: string): TransportCarrier[] {
  if (typeof window === 'undefined' || !tenantId) return []
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tenantId}`)
    if (!raw) {
      const defaults: TransportCarrier[] = [
        {
          id: 'carrier-def-1',
          name: 'Servientrega Express Ecuador',
          document: '1791234567001',
          vehiclePlate: 'PCX-7821',
          phone: '1800-737843',
          notes: 'Logística de courier nacional',
        },
        {
          id: 'carrier-def-2',
          name: 'Transportes Logística Directa',
          document: '0992345678001',
          vehiclePlate: 'GDK-6574',
          phone: '0998765432',
          notes: 'Transportista interprovincial frecuente',
        },
        {
          id: 'carrier-def-3',
          name: 'Retiro Directo por Personal del Cliente',
          document: '',
          vehiclePlate: '',
          notes: 'El cliente retira con su propio comisionado en rampa de despacho',
        },
      ]
      localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(defaults))
      return defaults
    }
    return JSON.parse(raw) as TransportCarrier[]
  } catch {
    return []
  }
}

export function saveTenantCarrier(
  tenantId: string,
  carrier: Omit<TransportCarrier, 'id'> & { id?: string }
): TransportCarrier {
  const current = getTenantCarriers(tenantId)
  const id = carrier.id || `carrier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const newEntry: TransportCarrier = {
    ...carrier,
    id,
    name: carrier.name.trim(),
    document: carrier.document.trim(),
    vehiclePlate: carrier.vehiclePlate.trim().toUpperCase(),
    phone: carrier.phone?.trim() || undefined,
    notes: carrier.notes?.trim() || undefined,
  }

  const existingIdx = current.findIndex((c) => c.id === id)
  let updated: TransportCarrier[]
  if (existingIdx >= 0) {
    updated = [...current]
    updated[existingIdx] = newEntry
  } else {
    updated = [newEntry, ...current]
  }

  if (typeof window !== 'undefined' && tenantId) {
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(updated))
  }
  return newEntry
}

export function deleteTenantCarrier(tenantId: string, carrierId: string): void {
  const current = getTenantCarriers(tenantId)
  const updated = current.filter((c) => c.id !== carrierId)
  if (typeof window !== 'undefined' && tenantId) {
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(updated))
  }
}
