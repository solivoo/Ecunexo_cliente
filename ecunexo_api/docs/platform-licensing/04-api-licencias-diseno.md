---
title: API de licencias — As-built
tags: [ecunexo, api, platform]
updated: 2026-08-17
---

# API de licencias — As-built

Inventario de rutas: [`ecunexo_license/04-api-licencias-diseno.md`](../../../ecunexo_license/04-api-licencias-diseno.md).

Host: `ecunexo_license_api` · `/api/v1/platform` · :5090.

**Implementado:** login, health, `POST/GET /licenses`, `POST .../reissue`, `GET .../status`, clientes `GET/POST`, planes CRUD, operadores, training.

**Backlog:** `GET/PATCH /customers/{id}`, `GET /licenses/{id}`, `revoke`, `reveal`.

Canje tenant: `POST /api/v1/onboarding/activate-license`. No usar `activation_codes` para emisión comercial.
