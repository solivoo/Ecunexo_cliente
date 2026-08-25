import type { ModuleEntitlementDto } from '@/services/authApi'
import { moduleLabel } from '@/lib/moduleLabels'

const TIER_LABELS: Record<number, string> = {
  0: 'Small',
  1: 'Medium',
  2: 'Big',
  3: 'Enterprise',
}

const LIMIT_LABELS: Record<string, string> = {
  max_sku_count: 'SKUs',
  max_variants_per_item: 'Variantes / ítem',
  max_categories: 'Categorías',
  max_warehouses: 'Bodegas',
  max_warehouse_count: 'Bodegas',
  max_invoices_per_month: 'Facturas / mes',
  invoice_history_months: 'Historial (meses)',
  max_users: 'Usuarios',
  max_training_sessions_per_year: 'Sesiones / año',
  max_training_hours_per_year: 'Horas / año',
  max_support_hours_per_year: 'Horas soporte / año',
}

function formatLimitKey(key: string): string {
  return LIMIT_LABELS[key] ?? key.replace(/^max_/, '').replace(/_/g, ' ')
}

function formatLimitValue(val: number): string {
  return val === -1 ? 'Ilimitado' : String(val)
}

export function PlanMetrics({
  planName,
  maxUsers,
  maxWarehouses,
  maxTenants,
  usersLabel = 'Usuarios / empresa',
  warehousesLabel = 'Bodegas / empresa',
  tenantsLabel = 'Cupo de empresas',
  userUsage,
}: {
  planName: string
  maxUsers: number
  maxWarehouses: number
  maxTenants: number
  usersLabel?: string
  warehousesLabel?: string
  tenantsLabel?: string
  userUsage?: { used: number }
}) {
  return (
    <div className="ecu-companies-page__metrics" aria-label="Resumen del plan">
      <article className="ecu-companies-page__metric">
        <p className="ecu-companies-page__metric-label">Plan</p>
        <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
          {planName}
        </p>
      </article>
      <article className="ecu-companies-page__metric">
        <p className="ecu-companies-page__metric-label">{usersLabel}</p>
        <p className="ecu-companies-page__metric-value">
          {userUsage ? (
            <>
              {userUsage.used}
              <span className="ecu-companies-page__metric-unit"> / {maxUsers}</span>
            </>
          ) : (
            maxUsers
          )}
        </p>
      </article>
      <article className="ecu-companies-page__metric">
        <p className="ecu-companies-page__metric-label">{warehousesLabel}</p>
        <p className="ecu-companies-page__metric-value">{maxWarehouses}</p>
      </article>
      <article className="ecu-companies-page__metric">
        <p className="ecu-companies-page__metric-label">{tenantsLabel}</p>
        <p className="ecu-companies-page__metric-value">{maxTenants}</p>
      </article>
    </div>
  )
}

export function ModuleChips({ modules }: { modules: string[] }) {
  if (modules.length === 0) {
    return <p className="app-shell__muted">Sin módulos habilitados.</p>
  }

  return (
    <ul className="ecu-plan-page__chips" aria-label="Módulos habilitados">
      {modules.map((code) => (
        <li key={code} className="ecu-plan-page__chip">
          {moduleLabel(code)}
        </li>
      ))}
    </ul>
  )
}

export function EntitlementCards({ entitlements }: { entitlements: ModuleEntitlementDto[] }) {
  if (entitlements.length === 0) {
    return <p className="app-shell__muted">Este plan no define tiers por módulo.</p>
  }

  return (
    <div className="ecu-plan-page__entitlements">
      {entitlements.map((e) => {
        const limits = e.limits ? Object.entries(e.limits) : []
        return (
          <article key={e.moduleCode} className="ecu-plan-page__entitlement">
            <header className="ecu-plan-page__entitlement-head">
              <h3 className="ecu-plan-page__entitlement-title">{moduleLabel(e.moduleCode)}</h3>
              <span className="ecu-plan-page__tier">{TIER_LABELS[e.tier] ?? `Tier ${e.tier}`}</span>
            </header>
            {limits.length > 0 ? (
              <dl className="ecu-plan-page__limits">
                {limits.map(([key, val]) => (
                  <div key={key} className="ecu-plan-page__limit">
                    <dt>{formatLimitKey(key)}</dt>
                    <dd>{formatLimitValue(val)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="ecu-plan-page__entitlement-empty">Sin límites específicos</p>
            )}
          </article>
        )
      })}
    </div>
  )
}
