# 13 — PostgreSQL: esquemas `tenancy` e `identity`

Este capítulo documenta **cómo se organizan las tablas en la base de datos** cuando miras el catálogo con DBeaver, `psql` u otra herramienta: qué va en cada **esquema** de PostgreSQL, por qué, y cómo se relaciona con el **multi-tenant** (que **no** es “un esquema por cliente”).

> 📚 Skills: `ecunexo-architecture`, `ecunexo-data-model`. Contexto funcional Identity: doc **11** y **12**. Onboarding y códigos: doc **14**. Primera capa Data / migraciones: doc **09**.

---

## 1. Idea general

| Concepto | En EcuNexo |
|---|---|
| **Esquema PostgreSQL** | Agrupa tablas de un **bounded context** (nombre estable: `tenancy`, `identity`, y en el futuro p. ej. `catalog`, `warehousing`). |
| **Aislamiento entre clientes (SaaS)** | **Una sola BD compartida**; el aislamiento es por columna **`tenant_id`** + **Global Query Filters** en EF Core, no por esquema por tenant. |
| **Historial de migraciones EF** | Tabla `tenancy.__ef_migrations_history` (configurada en `AddData`, no en `public`). |

> 💡 Ver muchas tablas bajo `identity` y pocas bajo `tenancy` es **esperado**: Tenancy expone el agregado raíz **Tenant**; Identity concentra usuarios, roles, permisos y políticas.

---

## 2. Esquema `tenancy`

| Tabla | Rol |
|---|---|
| **`tenants`** | Organizaciones cliente (agregado **Tenant**). Sin `tenant_id` propio: el propio `id` **es** el tenant. Incluye entitlements de suscripción cuando se usa onboarding por código: **`subscription_max_tenants`**, **`enabled_modules`** (jsonb, nullable). |
| **`activation_codes`** | Códigos de activación (huella + cupos + módulos + expiración). Ver doc **14** y migración **`AddActivationCodesAndTenantEntitlements`**. |
| **`__ef_migrations_history`** | Metadatos de **Entity Framework Core** (qué migraciones se aplicaron). Vive en este esquema por configuración explícita en `EcuNexo.Data/DependencyInjection.cs` (`MigrationsHistoryTable(..., "tenancy")`). |

Configuración típica en código: `Configurations/TenantConfiguration.cs` → `ToTable("tenants", "tenancy")`; `ActivationCodeConfiguration.cs` → `ToTable("activation_codes", "tenancy")`.

**Columnas de perfil UI / branding** (además de `id`, nombre, plan, estado, auditoría, `xmin`): `display_name`, `time_zone_id`, `locale`, `logo_url`, `primary_color_hex` — migración **`AddSaaSUiAndDirectoryColumns`**.

**Columnas de entitlements / onboarding** (migración **`AddActivationCodesAndTenantEntitlements`**): `subscription_max_tenants` (integer, default `1` en filas existentes), `enabled_modules` (jsonb, nullable — `null` = sin lista explícita de módulos para tenants previos al feature).

---

## 3. Esquema `identity`

| Tabla | Rol |
|---|---|
| **`users`** | Usuarios; llevan **`tenant_id`** (FK a `tenancy.tenants`). |
| **`roles`** | Roles por tenant; **`tenant_id`** + unicidad lógica de nombre por tenant. |
| **`permissions`** | Catálogo **global** de permisos (sin `tenant_id` en el sentido de fila multi-tenant del skill; ver entidad `Permission` en Core). |
| **`policies`** | Políticas ABAC asociadas a un permiso (doc **12**). |
| **`user_roles`** | N:M usuario ↔ rol. |
| **`role_permissions`** | N:M rol ↔ permiso. |

Cada `IEntityTypeConfiguration` en `src/EcuNexo.Data/Configurations/` fija el esquema con `ToTable("nombre_tabla", "identity")`.

> ⚠️ **No confundir**: el nombre del esquema **`identity`** es solo organización física. Los datos de usuario y rol siguen estando **acotados por `tenant_id`** en aplicación y en consultas filtradas.

**Columnas añadidas con SaaS / directorio** (misma migración que arriba):

| Tabla | Columnas nuevas (snake_case en BD) |
|---|---|
| `identity.users` | `phone`, `job_title`, `last_login_at` (`timestamptz`, nullable) |
| `identity.roles` | `description`, `is_system` (`boolean`, default `false`) |
| `identity.permissions` | `display_name`, `module`, `sort_order` (`integer`, default `0`) |

---

## 4. Esquema `public` u otros

Puede quedar vacío o con objetos por defecto de PostgreSQL. La aplicación EcuNexo **no** depende de poner tablas de negocio en `public` mientras las migraciones usen `tenancy` e `identity`.

---

## 5. Cómo comprobar que coincide con el código

1. **Migraciones**: el `ModelSnapshot` (`EcuNexo.Data/Migrations/EcuNexoDbContextModelSnapshot.cs`) lista cada entidad con `ToTable(..., "tenancy")` o `ToTable(..., "identity")`.
2. **Arranque de aplicación**: `dotnet ef database update` (ver doc **09**) debe dejar los mismos nombres que ves en el explorador del IDE/SQL.

---

## 6. Evolución prevista

Cuando existan **Catalog**, **Warehousing** o **Inventory**, lo coherente con esta bitácora es añadir **nuevos esquemas** (`catalog`, etc.) y tablas allí, manteniendo **Shared DB** + **`tenant_id`** donde aplique `ITenantEntity`, según `ecunexo-data-model`.

---

## 7. Referencias rápidas en el repo

| Tema | Ubicación |
|---|---|
| Historial de migraciones en `tenancy` | `DependencyInjection.cs` → `UseNpgsql(..., npg => npg.MigrationsHistoryTable(...))` |
| Tabla `tenants` + `activation_codes` | `TenantConfiguration.cs`, `ActivationCodeConfiguration.cs` |
| Tablas Identity | `UserConfiguration`, `RoleConfiguration`, `PermissionConfiguration`, `PolicyConfiguration`, `UserRoleConfiguration`, `RolePermissionConfiguration` |
| Columnas UI / directorio (DDL) | `Migrations/*_AddSaaSUiAndDirectoryColumns.cs` |
| Entitlements tenant + `activation_codes` (DDL) | `Migrations/*_AddActivationCodesAndTenantEntitlements.cs` |
