---
title: Modelo titular de licencia, empresas y RBAC tenant
tags: [ecunexo, licensing, rbac, tenancy, subscription]
---

# Titular de licencia (usuario raíz comercial) y RBAC por empresa

## Tres planos de identidad

| Plano | Entidad | JWT | Menú SPA | Permisos API |
|-------|---------|-----|----------|--------------|
| **A — Platform** | Operador Ecunexo | `aud=platform` | Panel CEO | `platform.*` |
| **B — Tenant** | `identity.users` | `sub` + `tid` | Operacional (`MenuContextKind.Operational`) | RBAC + módulos + ABAC Deny |
| **C — Suscripción** | `subscription_accounts` | `sub` + `pk=subscription` | Suscripción (`MenuContextKind.Subscription`) | `tenancy.tenants.*`, `tenancy.tenant.read` |

El **usuario raíz comercial** (titular) vive en el **plano C**. No es superusuario operativo del producto: gestiona la licencia y las empresas; la operación (equipo, roles, catálogo, facturación) ocurre en el **plano B** dentro de cada empresa.

## Flujo de vida

```mermaid
flowchart LR
  A[Canje licencia /bienvenida] --> B[Titular subscription_accounts]
  B --> C[GET /subscription/session]
  C --> D[Menú: Inicio, Empresas, Plan]
  D --> E[POST /subscription/companies]
  E --> F[Tenant + rol Administrador + permisos filtrados por módulos]
  D --> G[POST /subscription/companies/{id}/session]
  G --> H[JWT tenant + GET /tenants/{id}/session]
  H --> I[Menú operacional según RBAC y módulos]
  I --> J[Usuarios, roles, permisos, políticas ABAC]
```

### Paso 1 — Activación

- `POST /api/v1/onboarding/activate-license` crea `subscription_accounts` + `license_redemptions`.
- Respuesta: JWT de suscripción (`tenantId: null`, `isSubscriptionHolder: true`).
- **No** crea tenant ni usuarios de empresa en este paso.

### Paso 2 — Sesión de suscripción

- `GET /api/v1/subscription/session` devuelve:
  - Usuario titular (email, nombre, departamento…)
  - Bloque `subscription` (plan, cupos, `enabledModules`)
  - Permisos fijos: `tenancy.tenant.read`, `tenancy.tenants.read`, `tenancy.tenants.create`, `tenancy.tenants.delete`
  - Menú filtrado por contexto **Subscription** (sin Equipo, Seguridad, Facturación)

### Paso 3 — Crear empresa

- `POST /api/v1/subscription/companies` (titular autenticado).
- Crea `tenants` con `subscription_group_id` del titular y `enabled_modules` copiados de la licencia.
- Crea rol **Administrador** (sistema) y asigna **solo permisos activos cuyo módulo de producto esté en la licencia** (`ModulePermissionFilter`).
- Crea usuario admin de la empresa (email/contraseña del formulario).

> **Recomendación:** usar el **mismo correo** del titular al crear la empresa para poder usar «Entrar» sin otro login.

### Paso 4 — Entrar a la empresa

- `POST /api/v1/subscription/companies/{tenantId}/session`
- Valida que el tenant pertenezca al `subscription_group_id` del titular.
- Busca usuario activo en ese tenant con el **email del titular**.
- Emite JWT tenant (`sub` = userId, `tid` = tenantId).
- SPA recarga handshake con `GET /tenants/{tenantId}/session` → menú operacional completo según RBAC.

### Paso 5 — RBAC dentro de la empresa

Jerarquía objetivo (evolución):

1. **Empresa (tenant)** — límites de plan y módulos contratados
2. **Departamentos** — agrupación organizacional (fase 2; hoy `User.Department`)
3. **Usuarios** — `identity.users` con roles
4. **Roles** — `identity.roles` + `role_permissions`
5. **Permisos** — catálogo global `identity.permissions`
6. **Políticas ABAC** — `identity.policies` con `condicion_abac` (efecto Deny hoy; Allow en roadmap)

El rol **Administrador** recibe todos los permisos **de módulos contratados**, no el catálogo global completo si hay módulos no licenciados (p. ej. facturación sin `invoicing`).

## Licencia y módulos

| Campo licencia / tenant | Uso |
|-------------------------|-----|
| `enabled_modules` (jsonb) | Filtra menú, `ModuleEntitlementGuard` y asignación al rol Administrador |
| `subscription_max_tenants` | Cupo de empresas bajo la licencia |
| `plan_max_users` / `plan_max_warehouses` | Límites por empresa |

Mapeo permiso → módulo: prefijo del código (`identity.*` → `identity`, `facturacion.*` → `invoicing`). Ver ADR-006.

## Endpoints v1 (suscripción)

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/v1/subscription/session` | Titular JWT |
| GET | `/api/v1/subscription/companies` | `tenancy.tenants.read` |
| POST | `/api/v1/subscription/companies` | `tenancy.tenants.create` |
| POST | `/api/v1/subscription/companies/{tenantId}/session` | `tenancy.tenants.read` |
| DELETE | `/api/v1/subscription/companies/{tenantId}` | `tenancy.tenants.delete` |

## Legacy coexistiente

`POST /api/v1/onboarding/tenant-with-activation` sigue creando tenant + admin en un solo paso (modelo anterior). El flujo recomendado para multiempresa es **activate-license → subscription → companies**.

## Enlaces

- [[03-jerarquia-usuarios-plataforma]]
- [[07-mapeo-modulos-permisos]]
- [[09-seguridad-licencias-desacopladas]]
- [`docs/14-onboarding-y-codigos-activacion.md`](../14-onboarding-y-codigos-activacion.md)
