import { useCallback, useEffect, useState } from 'react'
import { useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import {
  ensureBillingEmitter,
  loadIssuerDefaults,
} from '@/pages/facturacion/invoiceEmitApi'
import { listInvoices } from '@/services/billingApi'
import { selectTenantBranding, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { InvoiceListItem } from '@/types/billingApi'

export function useBillingInvoices(range?: { readonly from: string; readonly to: string }) {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const branding = useAppSelector(selectTenantBranding)
  const [rows, setRows] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [emitterId, setEmitterId] = useState<string | null>(null)

  const from = range?.from
  const to = range?.to

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !from || !to) return
      setLoading(true)
      try {
        const defaults = await loadIssuerDefaults(tenantId)
        const id = await ensureBillingEmitter({
          emitterRuc: defaults.emitterRuc,
          company: defaults.company,
          companyLabel: defaults.company.legalName || branding.name || '',
          tenantId,
        })
        setEmitterId(id)
        const list = await listInvoices(id, { page: 1, pageSize: 200, from, to })
        setRows([...list.items])
        setTotalCount(list.totalCount)
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: `${list.totalCount} comprobante(s) en el periodo.`,
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los comprobantes.')
        setError(message)
        setRows([])
        setEmitterId(null)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, branding.name, toast, from, to]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  return { rows, loading, error, totalCount, emitterId, load, tenantId }
}
