# Plan de Cumplimiento y Auditoría (Compliance/Audit)

Documento de trabajo para diseñar la trazabilidad legal y técnica de EcuNexo SAS como
proveedor de software/SaaS (facturación electrónica, inventario, contabilidad, ecommerce).
**Fuera de alcance:** manejo de firma electrónica, certificados `.p12`/`.pfx` y material
criptográfico asociado (se tratará en un documento aparte).

> Nota: este documento es una guía técnica. Los textos legales, contratos y políticas deben ser
> revisados por un abogado ecuatoriano con experiencia en tecnología y LOPDP antes de publicarse.

---

## 1. Principio rector

No se trata de “protegerse de cualquier denuncia” (imposible), sino de poder **acreditar**:

```text
qué contrato estaba vigente
+ quién tenía autorización
+ qué hizo y cuándo lo hizo
+ qué datos recibió el sistema
+ qué se envió al SRI y qué respondió el SRI
+ que los controles de seguridad estaban funcionando
```

El software debe **producir evidencia**; el contrato y el sistema deben **separar
responsabilidades** entre SAS, cliente, SRI y entidad certificadora (ECI).

---

## 2. Marco normativo de referencia

| Norma / obligación | Impacto en el sistema |
|---|---|
| SRI — Resolución **NAC-DGERCGC26-00000027** (jul-2026): los proveedores de sistemas de facturación electrónica deben registrar esa actividad en el RUC, con establecimiento exclusivo, y el RUC del proveedor debe constar en los comprobantes emitidos a través de terceros | Configurar RUC del proveedor en la emisión (ya soportado en `infoAdicional`) y poder demostrar qué comprobantes se emitieron con ese RUC |
| **LOPDP** y su Reglamento: seguridad, confidencialidad y **responsabilidad demostrable**; evaluación de riesgos, seudonimización, bloqueo y eliminación | Registro de tratamientos, consentimientos separados, bitácora de accesos a datos personales, retención y eliminación |
| **Consentimiento y contratos electrónicos**: aceptación con evidencia (documento, versión, fecha, IP) | Módulo de documentos legales versionados y aceptaciones |

---

## 3. Diagnóstico del estado actual

| Capacidad | Estado | Evidencia en el código |
|---|---|---|
| Multitenancy real | Existe | `tenancy.tenants`, grupos de suscripción, entitlements por tenant |
| RBAC con permisos explícitos (`invoice.issue`, `user.disable`, …) | Existe | `identity.permissions`, `identity.role_permissions`, `PermissionAccessGuard`, políticas ABAC |
| Separación de operaciones y autoría básica | Parcial | `IAuditable` (`CreatedBy`/`UpdatedBy`) en entidades; sin bitácora global |
| Timeline por agregado | Parcial | `EcommerceOrderTimeline`, cambios de entitlements (licencias); no transversal |
| RUC del proveedor en comprobantes | **Existe** | `SriFacturaXmlGenerator.BuildInfoAdicional(..., SoftwareProviderRuc)` + `RideProviderOptions` |
| Páginas legales (T&C / privacidad) | Parcial | `ecunexo_admin` rutas `/terminos` y `/privacidad`; sin versionado ni aceptación registrada |
| Consentimiento de datos | Parcial | Checkout de vitrina: `DataConsentAtUtc` en pedidos; falta en registro/uso del software |
| Auditoría de accesos/exportaciones a datos personales | No existe | — |
| Incidentes de seguridad | No existe | — |
| Retención y bloqueo/eliminación | No existe | — |
| Principio de mínimo privilegio / MFA / secretos | Parcial | JWT, roles; secretos fuera de alcance (firma electrónica) |

---

## 4. Bloques objetivo

### 4.1 Documentos legales versionados y aceptaciones (evidencia de consentimiento)
- Tablas: `legal_documents` (código, versión, vigencia, hash del contenido, tipo:
  `terms`/`privacy`/`dpa`/`saas_contract`) y `legal_acceptances`
  (`tenant_id`, `user_id`, `document_code`, `version`, `accepted_at_utc`, `ip`, `user_agent`,
  `content_hash`, `request_id`).
- Flujo: aceptación obligatoria en primer acceso y cuando cambie la versión; re-aceptación
  bloqueante para funciones sensibles.
- UI: “Legal y cumplimiento → Términos y condiciones / Política de privacidad / Consentimientos”
  con descarga de evidencia por tenant/usuario.

### 4.2 Bitácora de auditoría inmutable (núcleo del plan)
- Tabla `audit_events`:
  `id`, `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `occurred_at_utc`,
  `ip_address`, `user_agent`, `request_id`, `previous_state_hash`, `new_state_hash`, `metadata`
  (jsonb), `chain_hash` (encadenado por tenant para detectar alteraciones).
- Reglas: solo inserción; ningún rol de cliente puede borrar/editar; retención definida;
  exportación firmada (CSV/JSON) para auditoría.
- Alcance de eventos (mínimos):
  `INVOICE_CREATED`, `INVOICE_SIGNED`, `INVOICE_SENT_SRI`, `INVOICE_AUTHORIZED`,
  `INVOICE_VOIDED`, `CREDIT_NOTE_CREATED`, `CREDIT_NOTE_AUTHORIZED`,
  `USER_CREATED`, `USER_DISABLED`, `ROLE_CHANGED`, `PERMISSION_CHANGED`,
  `TERMS_ACCEPTED`, `PRIVACY_POLICY_ACCEPTED`,
  `PRODUCT_PRICE_CHANGED`, `INVENTORY_ADJUSTED`, `COMPANY_TAX_DATA_CHANGED`,
  `ECOMMERCE_ORDER_PLACED`, `ECOMMERCE_ORDER_CANCELLED`, `PAYMENT_CONFIRMED`.
- Implementación: interceptor de comandos en `EcuNexo.Business` (el `ISender` ya centraliza
  comandos) + eventos explícitos en los flujos SRI (Billing) y de administración.

### 4.3 RBAC fuerte y demostrable
- Ya existe la base; falta auditar los cambios de permisos/roles y exponer “quién podía hacer
  qué y cuándo” (histórico de asignaciones).
- Regla: ninguna operación sensible sin permiso explícito (evitar `isAdmin` como atajo).

### 4.4 Tratamiento de datos personales (LOPDP)
- Registro de actividades de tratamiento (`data_processing_registry`): finalidad, categorías de
  datos, base legitimadora, destinatarios, plazo, medidas.
- Bitácora de accesos/exportaciones a datos personales (`personal_data_access_log`):
  quién consultó/exportó qué y cuándo.
- Consentimientos separados por finalidad (marketing vs. operación del servicio).

### 4.5 Retención, bloqueo y eliminación
- `retention_policies` por categoría (tributario, contable, datos personales de clientes,
  logs, auditoría) con plazos y acción (`block`, `anonymize`, `delete`).
- Jobs de retención con evidencia de ejecución; los documentos tributarios no se eliminan antes
  del plazo legal; los datos personales no se conservan “por si acaso”.

### 4.6 Incidentes de seguridad
- `incidents`: `id`, `severity`, `category`, `detected_at`, `reported_at`, `affected_tenants`,
  `affected_records`, `description`, `actions_taken`, `status`, `responsible`.
- Checklist de notificación y plazos (según LOPDP/reglamento), evidencias y post-mortem.

### 4.7 Cumplimiento SRI del proveedor
- Configurar en Ajustes el **RUC del proveedor** y el texto de `infoAdicional` (ya soportado en
  `SriFacturaXmlGenerator`).
- Tarea administrativa: registrar en el RUC la actividad de proveedor de sistemas de facturación
  electrónica y habilitar el establecimiento exclusivo exigido por la resolución.
- Reporte interno: comprobantes emitidos identificando el RUC del proveedor.

### 4.8 Expediente legal del tenant
- `tenant_legal_profile`: RUC, razón social, representante legal, correo, dirección, actividad
  económica + contrato SaaS + versiones aceptadas + usuarios autorizados + evidencias.
- UI “Legal y cumplimiento” (empresa) con exportación de evidencias.

---

## 5. Plan por fases

### Fase 0 — Fundaciones de evidencia (prioridad alta)
1. **Bitácora de auditoría inmutable** (`audit_events` + encadenado por tenant) con consulta,
   filtros y exportación; UI en `Configuración → Legal y cumplimiento → Registro de auditoría`.
2. **Documentos legales versionados y aceptaciones** (T&C, privacidad, DPA, contrato SaaS) con
   evidencia (IP, UA, hash, request id) y re-aceptación al cambiar versión.
3. **Auditoría de cambios de RBAC** (roles/permisos/usuarios) dentro del audit log.
Criterios: no se puede borrar un evento desde la app; cualquier operación sensible queda con
`tenant + user + acción + timestamp + IP + request_id`; exportación CSV/JSON por rango.

### Fase 1 — Datos personales y operación
4. Registro de tratamientos + consentimientos separados.
5. Bitácora de accesos/exportaciones a datos personales.
6. Políticas de retención con jobs de bloqueo/anonimización/eliminación y evidencia.
Criterios: se puede responder “¿quién accedió a los datos de este titular y con qué base?” y
“¿qué datos se eliminaron/bloquearon y cuándo?”.

### Fase 2 — Cumplimiento SRI del proveedor
7. Configuración y verificación del RUC del proveedor en emisión (XML + RIDE).
8. Registro administrativo de la actividad/establecimiento (tarea legal, no de código).
9. Reporte de comprobantes emitidos con identificación del proveedor.
Criterios: cualquier factura/NC emitida por el sistema muestra y registra el RUC del proveedor
cuando corresponde.

### Fase 3 — Incidentes y continuidad
10. Módulo de incidentes + checklist de notificación y plazos.
11. Evidencia de backups cifrados, restauración probada y logs de acceso a infraestructura.
Criterios: un incidente queda documentado con severidad, alcance, acciones y fechas.

### Fase 4 — Gobierno y revisión
12. Matriz RACI SAS / cliente / SRI / ECI y revisión legal de contratos.
13. Auditoría interna periódica del propio audit log (verificación de la cadena de hashes).
14. Métricas de controles en el dashboard de plataforma.

---

## 6. Modelo de datos propuesto (resumen)

```text
legal_documents(id, code, version, kind, effective_from, content_hash, content_url)
legal_acceptances(id, tenant_id, user_id, code, version, accepted_at_utc, ip, user_agent, content_hash, request_id)
audit_events(id, tenant_id, user_id, action, resource_type, resource_id, occurred_at_utc, ip, user_agent, request_id, previous_state_hash, new_state_hash, metadata, chain_hash)
data_processing_registry(id, tenant_id, purpose, data_categories, legal_basis, recipients, retention, security_measures)
personal_data_access_log(id, tenant_id, user_id, subject_type, subject_id, action, occurred_at_utc, ip, request_id)
retention_policies(id, category, retention_months, action, legal_basis)
incidents(id, severity, category, detected_at, reported_at, affected_tenants, affected_records, description, actions_taken, status, responsible)
tenant_legal_profile(tenant_id, ruc, legal_name, representative, email, address, economic_activity)
```

---

## 7. Matriz de evidencias para disputas

| Pregunta | Evidencia | Módulo |
|---|---|---|
| ¿Qué contrato/versión estaba vigente? | `legal_acceptances` (versión, hash, fecha) | Legal |
| ¿Quién autorizó/ejecutó la operación? | `audit_events` (user, role, permiso, IP, request id) | Auditoría + RBAC |
| ¿El sistema la creó solo? | Secuencia: usuario → comando → evento → respuesta SRI | Auditoría |
| ¿Qué se envió al SRI y qué respondió? | Logs de emisión + XML + estado/autorización | Facturación |
| ¿Qué datos personales se trataron? | Registro de tratamientos + bitácora de accesos | Protección de datos |
| ¿Se notificó un incidente a tiempo? | `incidents` (detección, reporte, acciones) | Incidentes |
| ¿Los datos se conservan/eliminan según política? | `retention_policies` + evidencia de jobs | Retención |

---

## 8. Riesgos y decisiones abiertas

1. **Dónde vive el audit log**: API del Cliente (transversal) vs. bus de eventos. Propuesta:
   interceptor de comandos en el Cliente + eventos SRI en Facturación.
2. **Inmutabilidad**: encadenado de hashes en PostgreSQL vs. almacenamiento WORM
   (S3 Object Lock). Propuesta: hash chain + respaldo periódico inmutable en B2/S3.
3. **Aislamiento multitenant del audit**: el cliente ve su bitácora; la plataforma ve todas.
4. **Retención tributaria vs. LOPDP**: plazos por categoría, con bloqueo en lugar de borrado.
5. **Acceso al audit log**: prohibido borrar incluso para administradores de tenant; en
   plataforma, solo rol de compliance.
6. **Plazos de notificación de brechas**: confirmar con abogado (LOPDP y su reglamento).
7. **Costo/volumen**: eventos de alto volumen (precios, inventario) pueden requerir muestreo o
   agregación; decidir qué se audita completo y qué se resume.

---

## 9. Checklist antes de lanzar comercialmente

Legal:
- [ ] Términos y condiciones, contrato SaaS, política de privacidad y acuerdo de tratamiento
      revisados por abogado ecuatoriano.
- [ ] Registro de la actividad de proveedor de facturación electrónica en el RUC y
      establecimiento exclusivo (resolución SRI vigente).
- [ ] Matriz de responsabilidades SAS / cliente / SRI / ECI anexa al contrato.

Técnico:
- [ ] Audit log inmutable con exportación y sin borrado desde la app.
- [ ] Aceptaciones versionadas con evidencia (IP, UA, hash, request id).
- [ ] RBAC auditado (cambios de rol/permiso).
- [ ] Retención definida por categoría con jobs y evidencia.
- [ ] Módulo de incidentes operativo.
- [ ] RUC del proveedor configurado y verificado en XML/RIDE.

---

## 10. Fuera de alcance de este plan

- Manejo de certificados de firma electrónica (`.p12`/`.pfx`), contraseñas y rotación de claves
  de firma (documento aparte).
- Textos legales definitivos (los redacta/revisa el abogado).
