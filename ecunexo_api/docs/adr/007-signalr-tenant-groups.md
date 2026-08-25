# ADR-007 — SignalR por grupos de tenant (pendiente)

**Estado:** Propuesto  
**Fecha:** 2026-05

## Contexto

Actualización de settings y permisos en tiempo real requiere SignalR con escalado horizontal (Redis backplane).

## Decisión prevista

1. Hub `NotificationHub`; conexión solo si `ui.realtime.enabled === true` (seed en `platform.sys_settings`).
2. `Groups.AddToGroupAsync(connectionId, tenantId)` — prohibido `Clients.All`.
3. Payloads: `{ type, code, value }` (ej. `PARAM_CHANGED`).
4. Cliente React: conectar condicionalmente según settings del handshake.

## Estado

No implementado en el epic Platform Update MVP; ver skill `ecunexo-platform-roadmap` fase 7.
