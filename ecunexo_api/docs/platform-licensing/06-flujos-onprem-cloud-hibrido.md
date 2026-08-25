---
title: Flujos — Cloud, on-prem e híbrido
tags: [ecunexo, flujos]
updated: 2026-06-12
---

# Flujos de despliegue

> Modelo titular → empresas: [[10-modelo-titular-suscripcion-rbac]].

## Cloud pequeño (una empresa)

1. Operador Ecunexo: emite licencia (`maxTenants=1`) en platform.
2. Cliente: `/bienvenida` → `activate-license` (código + artefacto).
3. Titular entra al panel: menú **Empresas** → crea la única empresa permitida.
4. **Entrar** a la empresa → operación diaria (usuarios, inventario, etc.).

## On-prem (servidor cliente)

1. Operador: emite licencia en panel platform.
2. Entrega código + `licenseArtifact` (email, USB, contrato).
3. Cliente instala API+BD en su infra; misma SPA apuntando a su URL.
4. Canje offline con `activate-license` (sin llamar a platform en runtime).

## Híbrido (1 empresa, BD local, facturación resiliente)

Igual on-prem + plan con módulo `invoicing`:

- Facturación electrónica activa en la licencia.
- Roadmap: cola local de comprobantes + sync cuando hay red.

## Multiempresa (holding)

1. Licencia con `maxTenants = 2..15` (p. ej. Starter multiempresa).
2. **Un titular** (`subscription_accounts`) agrupa empresas vía `subscription_group_id`.
3. Titular crea empresa A, B, C… con `POST /subscription/companies` hasta agotar cupo.
4. Cada empresa tiene su admin, roles y usuarios aislados (RBAC tenant).
5. Titular **entra** a cada empresa (`POST /subscription/companies/{id}/session`) si comparte email con el admin; si no, login directo con credenciales del admin.

> El flujo legacy de **reutilizar el mismo código** (`activation_codes` + `tenant-with-activation`) queda solo para dev/seeds. Producción comercial usa artefacto firmado + titular.

## Enlaces

- [[01-modelo-negocio-ecuador]]
- [[10-modelo-titular-suscripcion-rbac]]
- [`14-onboarding-y-codigos-activacion.md`](../14-onboarding-y-codigos-activacion.md)
