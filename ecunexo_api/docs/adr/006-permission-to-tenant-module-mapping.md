# ADR-006 — Mapeo permiso → módulo de producto

**Estado:** Aceptado  
**Fecha:** 2026-05

## Contexto

Los permisos globales usan códigos como `identity.users.read` o `catalog.product.read`. Los tenants tienen `enabled_modules` (jsonb) con códigos de `TenantModuleCodes` (`identity`, `catalog`, …). El guard de módulos debe bloquear permisos cuyo módulo de producto no esté contratado.

## Decisión

1. **Resolver módulo de producto** desde el **prefijo del código de permiso** (segmento antes del primer `.`), validado contra `TenantModuleCodes`.
2. `Permission.Module` en BD sigue siendo etiqueta de UI (p. ej. «Identity», «Catálogo»); no se usa para el guard macro.
3. `enabled_modules == null` → sin restricción explícita (compatibilidad tenants legacy).

## Implementación

- `PermissionModuleMapper.ResolveProductModule`
- `IModuleEntitlementGuard` invocado al inicio de `IPermissionAccessGuard.RequireAsync`
