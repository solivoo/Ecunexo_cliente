# Ecunexo_cliente

API tenant + SPA admin.

| | |
|---|---|
| Stack | `docker-compose.yml` |
| Env | `.env.example` → Portainer Env |
| SPA | `:5173` |
| API | `:5088` |
| BD | Postgres `ecunexo` (solo Cliente; no schema billing) |
| Keys | `/opt/ecunexo/cliente/keys/license-public.pem` |
| Docs API | `ecunexo_api/docs/` |

## Facturación

Datos de facturación viven en el stack **Facturación** (BD `billing` + Billing.Api).

El SPA los consume por HTTP: `VITE_BILLING_API_BASE_URL` → Billing.Api (ver `ecunexo_admin/src/services/billingApi.ts`).

Integración inversa (post-SRI): Billing.Api → esta API con `INVENTORY_EGRESS_API_KEY` (egreso inventario). No se comparte Postgres.
