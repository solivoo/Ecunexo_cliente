---
title: EcuNexo — Plataforma de licencias
tags: [ecunexo, platform, licensing, obsidian]
created: 2026-05-16
updated: 2026-08-17
---

# Plataforma de licencias EcuNexo

Documentación del **administrador de licencias** (operadores Ecunexo) y del API de emisión. Separado del panel tenant (`admin_tennant_*` → `ecunexo_api`).

## Índice

- [[00-vision-y-alcance]]
- [[01-modelo-negocio-ecuador]]
- [[02-planes-y-precios-ecuador]]
- [[03-jerarquia-usuarios-plataforma]]
- [[04-api-licencias-diseno]]
- [[05-admin-licencias-ui]]
- [[06-flujos-onprem-cloud-hibrido]]
- [[07-mapeo-modulos-permisos]]
- [[08-plan-tablas-bd]]
- [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md) — Catálogo vs Inventario, plan servicios, RBAC/ABAC
- **[[09-seguridad-licencias-desacopladas]]** — **modelo implementado (leer primero)**
- **[[10-modelo-titular-suscripcion-rbac]]** — titular, empresas, RBAC por tenant
- **[[11-formato-archivo-licencia]]** — archivo `.ecunexo-license` (código + upload)
- **[[12-module-entitlements]]** — tiers, límites transaccionales, dependencias entre módulos
- **[[13-compliance-reissue]]** — validación online/offline de licencias, reemisión
- [[templates/ficha-cliente-licencia]]

## Dos hosts

| Host | Carpeta | Puerto | BD |
|------|---------|--------|-----|
| Tenant | `ecunexo_api/` | 5088 | `ecunexo` |
| Platform | `ecunexo_license_api/` | 5090 | `licensing_ecunexo` |

Sin `ProjectReference` Platform ↔ Tenant. HTTP runtime **solo** `GET /licenses/{grantId}/status` (tenant → platform) cuando hay `PlatformApiBaseUrl`.

## Estado de implementación

| Componente | Estado |
|------------|--------|
| Emisión `IssueLicense` + artefacto firmado | Implementado (platform) |
| Canje `ActivateLicense` offline | Implementado (tenant) — crea **titular**, no tenant directo |
| `tenancy.subscription_accounts` | Implementado |
| `/api/v1/subscription/*` | Implementado (session, companies, enter) |
| SPA admin tenant (`ecunexo_admin`) | Implementado (bienvenida con `.ecunexo-license`, empresas, entrar) |
| Admin licencias UI (`ecunexo_license`) | Implementado (emisión + descarga `.ecunexo-license`) |
| `ModuleEntitlement` + tiers + límites | Implementado |
| `ModuleDependencyGraph` (jerarquía módulos) | Implementado |
| `LicenseComplianceService` (offline-first) | Implementado |
| `LicenseOnlineValidator` | Implementado |
| Reemisión (`ReissueLicense`) | Implementado |
| Capacitación + Soporte con rangos de fecha | Implementado |
| Planes personalizados (`licensing.plans`) | Implementado | |

## Código

| Artefacto | Ubicación |
|-----------|-----------|
| Core licensing (hash + firma) | `ecunexo_api/src/EcuNexo.Core/Licensing/` |
| Module Entitlements + DependencyGraph | `ecunexo_api/src/EcuNexo.Core/Tenancy/ModuleEntitlement.cs`, `ModuleDependencyGraph.cs`, `ModuleTierCatalog.cs` |
| Platform API | `ecunexo_license_api/` |
| Tenant canje + suscripción | `ecunexo_api/.../ActivateLicense/`, `SubscriptionEndpoints.cs` |
| Compliance + Online Validator | `ecunexo_api/.../Licensing/LicenseComplianceService.cs`, `ecunexo_api/.../Licensing/LicenseOnlineValidator.cs` |
| UI admin tenant | `ecunexo_admin/` |
| UI operadores | `ecunexo_license/` |

## Relación con docs tenant

| Tema | Documento |
|------|-----------|
| Onboarding legacy | [`14-onboarding-y-codigos-activacion.md`](../14-onboarding-y-codigos-activacion.md) |
| ADR | [`008-platform-licensing-admin.md`](../adr/008-platform-licensing-admin.md) |
| API tenant | [`10-api-host-y-endpoints.md`](../10-api-host-y-endpoints.md) |
