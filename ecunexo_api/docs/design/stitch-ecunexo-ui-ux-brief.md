# EcuNexo — Brief de diseño UI/UX para Stitch (SaaS multi‑tenant)

**Versión del brief:** 1.1  
**Idioma de la interfaz propuesta:** español (Ecuador / Latinoamérica como mercado primario; preparar copy para i18n futuro según `locale` del tenant).  
**Propósito:** Generar un sistema de diseño y pantallas de alta fidelidad alineado al **backend real** ya implementado (.NET 10, API REST v1, JWT, RBAC + ABAC).  
**Nota para la herramienta:** Este documento es la **única fuente de verdad funcional** para el MVP de administración; las áreas “futuras” (catálogo, bodegas, inventario) deben aparecer en navegación como **próximamente** o **placeholder** coherente con el product vision, sin inventar datos que no existan en API aún.

---

## 1. Visión del producto (intención)

**EcuNexo** es un **SaaS multi‑tenant** para **administrar inventarios, bodegas y tiendas en línea**. Hoy el backend expone de forma madura **Tenancy** (organizaciones cliente) e **Identity** (usuarios, roles, permisos globales, políticas ABAC). Los contextos **Catalog**, **Warehousing** e **Inventory** están en la hoja de ruta arquitectónica pero **aún no tienen pantallas de negocio conectadas a API**.

### 1.1 Propuesta de valor para el usuario admin

- Un solo panel donde el **administrador del tenant** gestiona **equipo**, **roles** y **accesos**, con visibilidad clara de **qué puede hacer cada persona**.
- Separación explícita entre:
  - **Operador del tenant** (dueño de su negocio / gerente ops).
  - **Administrador de plataforma** (futuro; hoy la UI puede anticipar “Permisos globales” solo para quien tenga capacidad técnica — en API algunos endpoints son sensibles, p. ej. políticas ABAC).

### 1.2 Principios UX (no negociables)

1. **Multi‑tenant first:** el usuario **siempre** sabe en qué **organización** está trabajando; el **branding** (nombre visible, color, logo) viene del tenant cuando exista.
2. **Seguridad comprensible:** permisos y roles se muestran en lenguaje humano (`displayName`, `module`, `description`) sin sacrificar el código técnico (`code`) accesible en detalle.
3. **Acciones destructivas o de alto impacto** (borrado futuro, revocar acceso masivo): confirmación, resumen del impacto, patrones de “type to confirm” cuando aplique en fases posteriores.
4. **Estados vacíos excelentes:** primera ejecución sin datos guiada; copys que expliquen el **por qué** de roles y permisos.
5. **Accesibilidad:** contraste WCAG 2.1 AA, foco visible, labels en formularios, `aria` en modales y tablas complejas, targets táctiles ≥ 44px.
6. **B2B denso pero legible:** tablas con filas escaneables, filtros laterales o chips, detalles en **drawer** o **página dedicada** según complejidad.

---

## 2. Identidad visual y sistema de diseño (directrices)

> El tenant puede suministrar `primaryColorHex` (`#RGB` o `#RRGGBB`) y `logoUrl`. La UI debe **derivar** tokens semánticos (primary, primary-hover, on-primary, surfaces, borders) a partir de ese color con algoritmo de contraste seguro; si no hay color, usar una **paleta por defecto** profesional (sugerencia: azul índigo neutro + grises fríos; evitar gradientes Chill excesivos en áreas de datos).

### 2.1 Tipografía

- **UI:** Sans geométrica o neo‑grotesca legible en tablas (p. ej. familia tipo Inter / Source Sans 3 / IBM Plex Sans).
- **Jerarquía:** H1 24–28 desktop / 20–22 mobile; body 14–16; captions 12–13 para metadatos (`createdAt`, ids).
- **Tablas:** números alineados; códigos de permiso en `monospace` discreto.

### 2.2 Layout

- **App shell:** sidebar colapsable (icon-only) + top bar con **selector de tenant** (si el usuario tuviera varios en el futuro), búsqueda global (fase 2), menú usuario.
- **Contenido:** max-width legible para formularios (~720px); tablas full-bleed dentro del content con sticky header.
- **Breakpoints:** mobile 320–767, tablet 768–1023, desktop 1024+; sidebar en mobile como **overlay**.

### 2.3 Componentes base esperados

Botones (primary / secondary / ghost / danger), inputs, selects con búsqueda, date display (fechas en zona del tenant), badges de estado, toasts, modales, drawers, paginación o infinite scroll (preferir paginación para B2B), **data table** con ordenación y columnas configurables en fase 2, skeleton loaders, empty states ilustrados ligeros (no infantiles).

### 2.4 Tipología de modal (léxico para Stitch / handoff)

Usar estos **tipos** en especificaciones y en el diseño para que herramientas y devs interpreten igual el comportamiento:

| Código | Tipo | Cuándo usarlo | Comportamiento esperado |
|--------|------|---------------|-------------------------|
| **T1** | **Formulario corto** | Alta/edición con pocos campos (≤ ~8) | Scroll mínimo; footer fijo con Cancelar + Guardar; validación inline. |
| **T2** | **Formulario extendido / editor** | Formularios con textarea grande o ayuda lateral (p. ej. condición ABAC) | Altura max ~85vh; zona principal + opcional **rail de ayuda**; mismo footer de acciones. |
| **T3** | **Selección con búsqueda** | Elegir **un** ítem de lista larga (rol, permiso) | Campo buscar + lista virtualizada o paginada; ítem seleccionable; Confirmar / Cancelar. |
| **T4** | **Confirmación** | Acción reversible o irreversible que exige explícitamente el sí del usuario | Título claro; cuerpo con **resumen del impacto**; primario alineado al riesgo (destructivo = rojo); secundario Cancelar. |
| **T5** | **Alerta / estado** | Sesión expirada, sin permiso, error bloqueante | Puede ser **bloqueante** (overlay completo); 1 CTA principal (“Volver a iniciar sesión”, “Entendido”). |
| **T6** | **Asistente (multi‑paso)** | Onboarding o flujo guiado | Indicador de pasos (1/3); Atrás / Siguiente / Omitir; último paso con CTA de cierre. |

**Convenciones visuales:** `sm` (~400px) para confirmaciones; `md` (~560px) formularios cortos y selección; `lg` (~720px) formulario extendido; en **mobile** los modales **full‑screen** o bottom-sheet según plataforma, manteniendo footer de acciones accesible.

**Accesibilidad mínima en todos:** `role="dialog"`, `aria-modal="true"`, título asociado con `aria-labelledby`, **focus trap**, devolver foco al disparador al cerrar, cerrar con `Escape` salvo modales bloqueantes de sesión donde el cierre solo vía CTA.

---

### 2.5 Inventario de modales del MVP (cantidad y especificación)

Para este proyecto se diseñan **12 patrones modales** (plantillas reutilizables). Varios flujos comparten el mismo patrón **T3** o **T1**, pero cada fila es una **variante de contenido** que Stitch debe **maquetar al menos una vez** para cubrir el MVP.

| # | Nombre en UI (sugerido) | Tipo §2.4 | Disparador | Contenido que debe mostrarse | CTA principal / secundario |
|---|-------------------------|-----------|------------|------------------------------|----------------------------|
| **M01** | Crear usuario | T1 | Lista usuarios “Invitar” / “Nuevo usuario”; atajo dashboard | Campos: email*, nombre*, departamento, teléfono, puesto (* obligatorios según API). Texto de ayuda: “El correo debe ser único en la organización.” | Primario: **Crear usuario** · Secundario: Cancelar |
| **M02** | Asignar rol al usuario | T3 | Detalle usuario → “Asignar rol”; acción rápida en fila de tabla | Buscador; lista de roles del tenant (`name`, chip **Sistema** si `isSystem`); estado vacío “No hay roles — crea uno primero”. Una selección única. | Primario: **Asignar** · Secundario: Cancelar |
| **M03** | Crear rol | T1 | Lista roles → “Crear rol” | Campos: nombre*, descripción. **Ocultar** `isSystem` para admin típico; si se muestra (superadmin), advertencia inline. | Primario: **Crear rol** · Cancelar |
| **M04** | Agregar permiso al rol | T3 | Detalle rol → “Agregar permiso” | Buscador sobre catálogo global; columnas sugeridas en lista: `displayName`, `code`, `module`; excluir permisos ya vinculados al rol. | Primario: **Agregar** · Cancelar |
| **M05** | Crear permiso (plataforma) | T1 | Lista permisos global → “Nuevo permiso” (solo si menú visible) | `code*`, `displayName`, `module`, `sortOrder`, `description`; ayuda formato código `dominio.recurso.accion` | Primario: **Crear permiso** · Cancelar |
| **M06** | Nueva política ABAC | T2 | Detalle permiso → “Nueva política” (requiere `identity.policies.manage`) | `effect` (Allow/Deny) con **radios** o segmented control; `condition` textarea + enlace “Sintaxis y variable ctx”; panel colapsable de ayuda. Estados: error de validación bajo el editor. | Primario: **Crear política** · Cancelar |
| **M07** | Quitar rol del usuario | T4 | Detalle usuario → “Quitar” en chip de rol *(cuando exista API DELETE)* | Texto: “¿Quitar el rol **{nombreRol}** a **{nombreUsuario}**? No elimina al usuario.” Variante **destructiva suave** (no borra datos). | Primario: **Quitar** (estilo danger) · Cancelar |
| **M08** | Quitar permiso del rol | T4 | Detalle rol → quitar permiso *(cuando exista API)* | “El rol dejará de incluir **{displayName o code}**.” | Primario: **Quitar** (danger) · Cancelar |
| **M09** | Cerrar sesión | T4 | Menú usuario → “Cerrar sesión” | “¿Salir de EcuNexo?” Sin datos sensibles en el cuerpo. | Primario: **Cerrar sesión** · Cancelar |
| **M10** | Sesión expirada | T5 | Token inválido / 401 global | Mensaje breve; icono opcional; sin cerrar con Escape si se desea forzar re-login. | CTA única: **Iniciar sesión de nuevo** |
| **M11** | Sin autorización | T5 | Tras 403 en acción gating | Título “No tienes permiso”; cuerpo con permiso o recurso solicitado (si API lo devuelve). | **Entendido** o **Volver** |
| **M12** | Herramienta desarrollador (token) | T1 | Login → panel “Desarrollador” *(solo entorno Development)* | Campos `userId`, `tenantId` (GUID); botón “Generar”; área de solo lectura para pegar `accessToken` o copiar al portapapeles. Aviso: “No usar en producción.” | Primario: **Generar token** · Cancelar |

**Asistente aparte (no cuenta como modal suelto, mismo componente T6):**

| ID | Nombre | Tipo | Descripción para Stitch |
|----|--------|------|-------------------------|
| **W01** | Tour de bienvenida | **T6** (3 pasos) | Paso 1: “Tu organización” (branding / tenant). Paso 2: “Invita a tu equipo”. Paso 3: “Roles agrupan permisos”. Botones: **Omitir** visible siempre; **Siguiente** / **Finalizar** en último paso. No bloquear la app indefinidamente: permitir cerrar con X. |

**Resumen de conteos**

| Concepto | Cantidad |
|----------|----------|
| Modales **M01–M12** (patrones a diseñar en alta fidelidad) | **12** |
| Asistente onboarding **W01** (1 flujo, 3 pasos internos) | **1** |
| Reutilización | **M02** y **M04** comparten layout **T3**; **M07–M09** comparten layout **T4** con distinto copy/riesgo |

**Cómo describir un modal en tickets o en Stitch (plantilla)**

```text
Modal [Mxx] — [Nombre]
- Tipo: T1 | T2 | T3 | T4 | T5 | T6
- Tamaño: sm | md | lg | full-screen (mobile)
- Origen: [pantalla] → [acción]
- Usuario objetivo: [admin tenant | operador plataforma]
- Contenido: [lista de campos / lista / mensaje]
- CTAs: primario [verbo], secundario Cancelar, ¿Escape cierra? sí/no
- Estados extra: loading en botón primario, error API inline
```

---

## 3. Modelo mental multi‑tenant y branding

### 3.1 Contexto de organización (tenant)

Campos relevantes expuestos por API (JSON **camelCase**):

| Campo API | Uso en UI |
|-----------|-----------|
| `name` | Nombre legal/técnico de la organización |
| `displayName` | Nombre mostrado en cabecera y login; fallback a `name` si null |
| `timeZoneId` | Formateo de fechas (`LastLoginAt`, `createdAt`) |
| `locale` | Preferencia de formato regional (preparar i18n) |
| `logoUrl` | Avatar/logo en sidebar y login |
| `primaryColorHex` | Color de acento del tema |
| `status` | Badge (activo/suspendido/etc. según enumeración que muestre el API) |
| `servicePlanName`, `maxUsers`, `maxWarehouses` | Tarjeta “Plan y límites” en **Ajustes del tenant** |

**Requisito:** al cargar sesión, obtener `GET /api/v1/tenants/{tenantId}` y aplicar tema; mostrar chip “Plan: {servicePlanName}” con límites.

### 3.2 Usuario autenticado

- Tras login, persistir `accessToken`, `tenantId` activo y claims útiles.
- En **Development**, existe flujo de prueba: `POST /api/v1/auth/dev-token` con `userId`, `tenantId` opcional; en producción la UI debe usar el flujo de auth real (aún por definir en front — diseñar pantalla de login genérica JWT + selector de tenant si aplica).

---

## 4. Arquitectura de información (mapa del producto)

### 4.1 Navegación principal (MVP conectado a API)

1. **Inicio / Resumen** — KPIs placeholder + enlaces rápidos (“Invitar usuario”, “Crear rol”) si el permiso lo permite.
2. **Organización**
   - **Perfil y branding** (datos del tenant + color/logo/zona horaria/idioma — lectura segura; edición si existiera endpoint futuro o solo lectura por ahora con CTA “Contactar soporte”).
   - **Plan y uso** (lectura de límites `maxUsers`, `maxWarehouses`).
3. **Equipo**
   - **Usuarios** — lista, detalle, alta.
   - **Roles** — lista, detalle, alta, asignación de permisos al rol.
   - **Asignaciones** — matriz simplificada **usuario → roles** desde detalle de usuario (patrón recomendado).
4. **Seguridad (avanzado)**
   - **Permisos (catálogo global)** — solo para rol de “operador de plataforma” o usuario con permiso equivalente en el futuro; hoy en API la lista global `GET /api/v1/permissions` existe.
   - **Políticas ABAC** — anidadas bajo cada permiso (`GET/POST .../permissions/{id}/policies`); requiere permiso `identity.policies.manage`; UI tipo “editor seguro” con validación y ayuda contextual.

### 4.2 Navegación futura (sin backend aún — placeholders honestos)

- **Catálogo** — Productos, categorías, variantes.
- **Bodegas** — Ubicaciones, centros de distribución.
- **Inventario** — Stock, movimientos, transferencias.
- **Tienda en línea** — Canales de venta (futuro).

Cada ítem debe mostrar estado **“Próximamente”** con breve descripción de valor y deshabilitar interacción, **sin simular datos**.

---

## 5. Pantallas detalladas (flujos, estados, microcopy)

> Convención: listas con columnas ordenables donde tenga sentido; acciones en fila con menú “···”. Errores API: renderizar **ProblemDetails** (title, detail, status) en toast o inline.

### 5.1 Login

- Campos: email, contraseña (si el flujo OAuth llega después, mantener layout extensible).
- En Development: toggle “Desarrollador” con pegado de **token** o asistente que llama a `dev-token` (opcional en diseño).
- Recordación de **tenant**: si el usuario tiene `tenantId` en claim, pre-seleccionar organización.
- **Empty security:** enlaces política de privacidad y soporte (placeholder).

### 5.2 Inicio (Dashboard)

- Cards: “Usuarios activos”, “Roles”, “Permisos efectivos del usuario actual” (último como tooltip educativo).
- **Actividad reciente:** placeholder hasta endpoint de auditoría.
- **Banner** si el tenant está cerca del límite `maxUsers` (derivado de conteo en cliente o futuro endpoint).

### 5.3 Organización — Perfil y branding

Secciones:

1. **Identidad:** `displayName`, `name`, `logoUrl` (preview), `primaryColorHex` con **live preview** del botón primario.
2. **Regional:** `timeZoneId` (select con búsqueda IANA), `locale` (select BCP 47).
3. **Estado:** chip `status`.
4. Solo lectura si no hay PATCH en API: botón principal deshabilitado + texto “La edición de organización estará disponible en la siguiente versión”.

**Wireframe mental:** grid 2 columnas desktop; stack en mobile.

### 5.4 Organización — Plan y uso

- Tarjeta: **Plan** `servicePlanName`.
- **Límites:** `maxUsers`, `maxWarehouses` con barras de uso (uso requiere conteo: en MVP calcular client-side desde listas o mostrar solo límites hasta endpoint de métricas).

### 5.5 Equipo — Usuarios (lista)

**Data source:** `GET /api/v1/tenants/{tenantId}/users`

Columnas sugeridas:

| Columna | Campo |
|---------|-------|
| Nombre | `name` |
| Email | `email` |
| Departamento | `department` |
| Teléfono | `phone` |
| Puesto | `jobTitle` |
| Último acceso | `lastLoginAt` formateado con `timeZoneId` |
| Alta | `createdAt` |

**Acciones:** “Ver detalle”, “Asignar roles” (shortcut).

**Estados:** loading skeleton; vacío con CTA “Invitar usuario”; error con reintentar.

### 5.6 Equipo — Usuario (detalle)

**Data source:** `GET /api/v1/tenants/{tenantId}/users/{userId}`

Secciones:

1. **Cabecera:** nombre, email, badges de departamento / puesto.
2. **Contacto:** `phone`, `jobTitle`.
3. **Sesión:** `lastLoginAt` (relativo + absoluto en tooltip).
4. **Roles asignados:** lista de `roleIds` — resolver nombres vía cache de roles o segunda petición.
5. **Permisos efectivos:** `effectivePermissionCodes` en **acordeón por módulo** (parsear prefijo antes del punto o usar `GET /permissions` para enriquecer con `displayName` y `module`).

**Acciones:**

- “Asignar rol” → modal searchable de roles (`GET .../roles`).
- “Quitar rol” → confirmación (si existe endpoint futuro; si no, ocultar).

**Data source alta:** `POST /api/v1/tenants/{tenantId}/users` con body  
`email`, `name`, `department?`, `phone?`, `jobTitle?`  
Validación cliente: email, longitudes razonables, mensajes en español alineados a errores de negocio.

### 5.7 Equipo — Roles (lista)

**Data source:** `GET /api/v1/tenants/{tenantId}/roles`

Columnas: nombre, descripción truncada, badge **Sistema** si `isSystem`, fecha de creación.

**Reglas UX:**

- Roles con `isSystem: true`: no mostrar acción “Eliminar”; icono candado o tooltip “Rol protegido por la plataforma”.
- CTA “Crear rol”.

**Alta:** `POST .../roles` con `name`, `description?`, `isSystem?` (default false; para org admin, **ocultar** `isSystem` o mostrar con advertencia fuerte).

### 5.8 Equipo — Rol (detalle)

**Data source:** `GET /api/v1/tenants/{tenantId}/roles/{roleId}`

Secciones:

1. Resumen: nombre, descripción, `isSystem`.
2. **Permisos otorgados:** lista de `permissionIds` — enriquecer con `GET /api/v1/permissions` para mostrar `code`, `displayName`, `module`, `sortOrder`.
3. **Agregar permiso:** modal con buscador global de permisos; `POST .../roles/{roleId}/permissions` con `{ permissionId }`.
4. **Quitar permiso:** confirmación; endpoint futuro — si no existe, diseñar pero marcar como disabled.

### 5.9 Asignar rol a usuario

**Data source:** `POST /api/v1/tenants/{tenantId}/users/{userId}/roles` con `{ roleId }`.

- Modal elegir rol con búsqueda.
- Éxito: toast + invalidación de cache de detalle usuario.

### 5.10 Seguridad — Catálogo de permisos (global)

**Data source:** `GET /api/v1/permissions`

Vista tabla + agrupación por **`module`** (headers sticky). Columnas: `displayName` (fallback a `code`), `code` monospace, `description`, `status`, `sortOrder`.

**Detalle permiso:** `GET /api/v1/permissions/{permissionId}`.

**Alta permiso (operador plataforma):** `POST /api/v1/permissions`  
Body: `code`, `description?`, `displayName?`, `module?`, `sortOrder?`  
Formulario con ayuda: “Formato `dominio.recurso.acción` en minúsculas”.

### 5.11 Seguridad — Políticas ABAC (dentro del permiso)

**Requisito de acceso:** usuario con permiso efectivo `identity.policies.manage` (verificación vía `GET /api/v1/tenants/{tenantId}/authorization/verify?permission=identity.policies.manage`).

**Listado:** `GET /api/v1/permissions/{permissionId}/policies`  
**Alta:** `POST /api/v1/permissions/{permissionId}/policies` — body `effect` (`Allow` | `Deny`), `condition?` (expresión; editor de texto con resaltado, plantillas sugeridas, documentación colapsable “Variable disponible: ctx”).

**UX crítica:**

- Explicar en 2–3 frases qué es **Allow** vs **Deny**.
- Prevenir doble negación confusa; mostrar orden de evaluación (aunque sea copy genérico hasta doc de negocio).
- Bloquear envío si el campo condición tiene sintaxis inválida (mensaje cercano al backend).

### 5.12 Diagnóstico de autorización (herramienta dev / soporte)

Pantalla opcional **“Simular acceso”**: input de código de permiso → llama  
`GET /api/v1/tenants/{tenantId}/authorization/verify?permission=...`  
Mostrar resultado **concedido / denegado** con código HTTP y payload; útil para soporte interno — marcar como avanzado.

---

## 6. Patrones transversales

### 6.1 Permisos en la UI (ocultar vs deshabilitar)

- Si el usuario **no** tiene un permiso: **ocultar** la entrada de menú (preferido) o mostrar deshabilitada con tooltip “Sin permiso” según severidad.
- Para acciones peligrosas, **deshabilitar** con explicación.

### 6.2 Fechas y zona horaria

- Siempre preferir `timeZoneId` del tenant para formateo; fallback a zona local del navegador.

### 6.3 Feedback de errores

- **400** validación: mostrar errores por campo.
- **401 / 403:** pantalla o modal de sesión expirada / permiso denegado.
- **404:** empty state con enlace atrás.
- **409:** conflicto (ej. duplicados) con mensaje claro y acción sugerida.

### 6.4 Onboarding demo (Development)

Seed crea tenant **“Everchic Demo”**, usuario **superusuario.seed@ecunexo.local**, permisos y rol administrador (permisos activos globales). Además existe flujo de **código de activación** en Development (**14**). Diseñar **tour de 3 pasos** opcional: “Tu organización”, “Invita al equipo”, “Entiende roles y permisos”.

---

## 7. Entregables esperados de Stitch

1. **Design tokens** (color, tipo, espaciado, radius, elevación) + modo claro; modo oscuro **opcional** fase 2.
2. **Kit de componentes** coherente con las pantallas anteriores, incluyendo **variantes de modal** alineadas a **§2.4** (T1–T6).
3. **Flujos en alta fidelidad** para: Login, Dashboard, Lista/Detalle Usuario, Lista/Detalle Rol, Lista/Detalle Permiso, Editor de políticas ABAC, Ajustes de organización.
4. **Catálogo modales §2.5:** al menos **un mock por ID M01–M12** (los que comparten tipo pueden compartir frame con anotación de variante) **más** **W01** en sus 3 pasos o estado animado único.
5. **Responsive** de las 6 vistas críticas en mobile **y** comportamiento de **T1–T5** en viewport estrecho (full-screen / sheet).
6. **Especificaciones** para handoff: espaciado, estados hover/focus/disabled, comportamiento de modales y tablas, **plantilla de descripción** §2.5.

---

## 8. Glosario corto (copy)

| Término en UI | Definición corta para tooltips |
|---------------|--------------------------------|
| Organización (Tenant) | Espacio aislado de tu empresa y sus datos en EcuNexo. |
| Rol | Conjunto de permisos que puedes asignar a personas con un nombre claro (ej. “Encargado de bodega”). |
| Permiso | Acción concreta en el sistema (ej. ver productos). |
| Política ABAC | Regla que afinar el permiso según contexto (Allow/Deny y condición). |
| Permiso efectivo | Resultado final tras combinar todos los roles del usuario. |

---

## 9. Checklist de alineación con API v1

- [ ] Todas las entidades listadas mapean a campos **camelCase** del OpenAPI.
- [ ] Flujos POST cubren respuesta **201** + header `Location` cuando corresponda.
- [ ] Acciones que requieren `identity.policies.manage` están agrupadas y protegidas visualmente.
- [ ] Branding del tenant (`logoUrl`, `primaryColorHex`, `displayName`) visible en shell.
- [ ] Módulos futuros (Catálogo, Bodegas, Inventario) visibles pero no simulan datos.
- [ ] Inventario **§2.5**: los **12** modales + **W01** tienen diseño o variante documentada; tipos **T1–T6** usados de forma consistente.

---

*Fin del brief — listo para pegar en Stitch o herramienta similar.*
