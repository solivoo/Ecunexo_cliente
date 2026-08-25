---
title: Visión y alcance — Admin de licencias
tags: [ecunexo, platform]
updated: 2026-08-17
---

# Visión y alcance

Documento alineado con el as-built. Fuente del panel: [`ecunexo_license/00-vision-y-alcance.md`](../../../ecunexo_license/00-vision-y-alcance.md).

## Arquitectura

| Host | Carpeta | Puerto | BD |
|------|---------|--------|-----|
| Tenant | `ecunexo_api/` | 5088 | `ecunexo` |
| Platform | `ecunexo_license_api/` | 5090 | `licensing_ecunexo` |

Canje: `POST /api/v1/onboarding/activate-license`. Módulo facturación: `facturacion`.

HTTP tenant → platform: solo `GET /api/v1/platform/licenses/{grantId}/status`.

## Enlaces

- [[09-seguridad-licencias-desacopladas]]
- [[04-api-licencias-diseno]]
