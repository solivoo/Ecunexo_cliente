# ADR 008 — Administrador de licencias y API Platform

**Estado:** Aceptado (implementado v1)  
**Fecha:** 2026-05-16  
**Actualización:** 2026-05-16 — desacoplamiento total tenant/platform

## Contexto

EcuNexo vende licencias a clientes cloud, on-prem e híbridos. Un administrador del despliegue cliente no debe poder emitir licencias ni acceder a la BD comercial de Ecunexo.

## Decisión

1. **Dos hosts independientes** en el monorepo: `ecunexo_platform_api/` (emisión) y `ecunexo_api/` (tenant).
2. **Dos bases de datos**: `licensing_ecunexo` (solo platform) y `ecunexo` (solo tenant).
3. **Doble hash**: `IssuePepper` (solo CEO/platform) vs `ValidationPepper` (platform al firmar + tenant al canjear).
4. **Artefacto firmado RSA-PSS**: platform firma con clave privada; tenant verifica con clave pública. El provisioning viaja en el payload firmado.
5. **Canje offline**: `POST /api/v1/onboarding/activate-license` con `activationCode` + `licenseArtifact`. Sin HTTP a platform. Sin `ConnectionStrings:Licensing` en tenant.
6. **Anti-reuso local**: `tenancy.license_redemptions` por `grant_id`.
7. **Cero** `ProjectReference` entre soluciones Platform y Tenant (comparten solo tipos en `EcuNexo.Core`).
8. Legacy: `activation_codes` + `tenant-with-activation` limitado a desarrollo.

## Consecuencias

- Entregar al cliente: `ValidationPepper`, PEM público, `licenseArtifact` + código (canal seguro).
- Clave privada de firma y `IssuePepper` solo en infraestructura Ecunexo (Key Vault / HSM en producción).
- `admin_platform` → puerto 5090; `admin_tennant_*` → 5088.
- Fase 2 opcional: revocación online sin mezclar con emisión.

## Alternativas rechazadas

- Tenant leyendo `licensing_ecunexo` por `code_hash` con el mismo pepper de emisión.
- HTTP tenant → platform en cada activación (platform no existe on-prem).
- `ProjectReference` de tenant a `EcuNexo.Platform.Data`.

## Referencias

- `docs/platform-licensing/09-seguridad-licencias-desacopladas.md`
- `ecunexo_platform_api/docs/01-emision-licencias.md`
- Skill `.cursor/skills/ecunexo-licensing-security/SKILL.md`
