---
title: Formato de archivo .ecunexo-license
tags: [ecunexo, licensing, onboarding, tenant]
status: implementado
created: 2026-06-12
---

# Formato de archivo `.ecunexo-license`

## 1. Propósito

Al emitir una licencia comercial, Ecunexo entrega **dos piezas** al cliente:

1. **Código de activación** — texto corto que el usuario escribe en el onboarding.
2. **Archivo `.ecunexo-license`** — JSON con metadatos legibles y el **artefacto firmado RSA** que valida el tenant offline.

El backend tenant **no cambia**: sigue recibiendo `activationCode` + `licenseArtifact` (string JSON del envelope firmado). El SPA admin extrae `artifact` del archivo antes de llamar a `POST /api/v1/onboarding/activate-license`.

## 2. Estructura del archivo

Extensión recomendada: `.ecunexo-license`  
MIME sugerido: `application/json`

```json
{
  "format": "ecunexo-license",
  "formatVersion": 1,
  "issuedAt": "2026-06-12T15:30:00.000Z",
  "planLabel": "Starter Cloud",
  "enabledModules": ["identity", "inventory", "warehousing"],
  "artifact": {
    "version": 1,
    "payloadBase64Url": "...",
    "signatureBase64Url": "..."
  }
}
```

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `format` | Sí | Constante `ecunexo-license` |
| `formatVersion` | Sí | `1` (versión del wrapper, no del payload RSA) |
| `issuedAt` | No | ISO 8601; solo informativo en UI |
| `planLabel` | No | Etiqueta del plan para el cliente |
| `enabledModules` | No | Códigos de módulo licenciados (informativo) |
| `artifact` | Sí | Envelope firmado devuelto por platform (`licenseArtifact`) |

El payload RSA dentro de `artifact` incluye además `onlineValidationIntervalDays` y, en reemisiones, `supersedesGrantId` apuntando al grant revocado.

## 3. Compatibilidad al importar

El onboarding (`ecunexo_admin`) acepta:

- Archivo `.ecunexo-license` con wrapper (formato anterior).
- JSON crudo del envelope `{ version, payloadBase64Url, signatureBase64Url }` (retrocompatibilidad operativa).

En ambos casos el cliente envía a la API únicamente el JSON normalizado del `artifact`.

## 4. Emisión (platform UI)

Tras `POST /api/v1/platform/licenses`, el admin de licencias (`ecunexo_license`) ofrece:

- Copiar **código** (una sola vez).
- **Descargar** `ecunexo-{plan}.ecunexo-license`.
- Copiar artefacto JSON (soporte técnico).

## 5. Canje (tenant UI)

Pantalla de bienvenida (`ecunexo_admin`):

1. Campo **código de activación**.
2. **Upload** del archivo `.ecunexo-license`.
3. `POST /api/v1/onboarding/activate-license` con código + `licenseArtifact` extraído.

## 6. Seguridad

- El archivo **no sustituye** al código: ambos son necesarios (posesión del archivo + conocimiento del código).
- La firma RSA y `validationHash` siguen definidos en [[09-seguridad-licencias-desacopladas]].
- `planLabel` y `enabledModules` en el wrapper son **informativos**; la fuente de verdad tras el canje es `subscription_accounts` y `tenants.enabled_modules` en BD tenant.

## Enlaces

- [[09-seguridad-licencias-desacopladas]]
- [[10-modelo-titular-suscripcion-rbac]]
- [`14-onboarding-y-codigos-activacion.md`](../14-onboarding-y-codigos-activacion.md)
