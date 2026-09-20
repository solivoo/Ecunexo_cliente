---
name: licenciamiento-modulo-prompt
description: >-
  Generación obligatoria de prompts estandarizados para el subsistema de licencias (platform-licensing)
  cada vez que se crea o desarrolla un nuevo módulo en EcuNexo (código de módulo, dependencias, permisos RBAC,
  tiers, límites transaccionales y rutas SPA).
---

# Generación de Prompts para el Módulo de Licencias (EcuNexo)

Este skill define la norma técnica y el formato estandarizado que el agente **SIEMPRE debe generar y entregar al usuario** cada vez que se crea, diseña o culmina un nuevo módulo funcional en el ecosistema EcuNexo.

El objetivo es que el usuario pueda copiar directamente el bloque de prompt generado y enviarlo al agente, proyecto o repositorio responsable de la emisión de licencias, activación de tenants y planes (`ecunexo-licensing` o `platform-licensing`).

---

## 1. Regla de Activación Obligatoria

> [!IMPORTANT]
> **TRIGGER OBLIGATORIO AL CREAR UN MÓDULO**:
> Cada vez que se introduzca un nuevo módulo de negocio en EcuNexo (por ejemplo: `compras`, `taller`, `ecommerce`, `clientes`, etc.) o se amplíen sustancialmente sus capacidades y permisos:
> 
> El agente **DEBE incluir al final de su respuesta un bloque de prompt listo para copiar**, formateado según la estructura especificada en este documento.

---

## 2. Taxonomía Obligatoria y Razonamiento Previo

> [!CAUTION]
> **REGLA DE TAXONOMÍA CANÓNICA (skill `ecunexo-module-taxonomy-reasoning`)**:
> En EcuNexo existen **únicamente 12 módulos raíz**: `identity`, `catalog`, `warehousing`, `inventory`, `facturacion`, `purchases`, `contabilidad`, `customers`, `ecommerce`, `repairs`, `training`, `support`.
> **NUNCA** registrar submódulos artificiales como `catalog.matrix`, `credit_notes` o `billing.remision_guides`.
> - Las variantes, escalas y producto matriz pertenecen a **`catalog`**.
> - Las notas de crédito (04), guías de remisión (06) y notas de débito (05) pertenecen a **`facturacion`**.
> Si se crea una subcapacidad, el prompt debe solicitar una **actualización de límites/permisos del módulo raíz correspondiente**, no un módulo nuevo.

## 3. Componentes que Requiere el Subsistema de Licencias

Para que un módulo o extensión sea comercializado, emitido en archivos de licencia `.lic` criptográficos y habilitado en las empresas (`tenants.enabled_modules`), el módulo de licencias necesita:

1. **`ModuleCode` Canónico:** Uno de los 12 módulos raíz (`TenantModuleCodes.cs`). Si es una extensión, indicar el módulo raíz al que pertenece.
2. **Nombre Comercial & Descripción:** Nombre para el panel de ventas y portal de licencias.
3. **Dependencias del Módulo (`ModuleDependencyGraph`):**
   * Módulos requeridos obligatorios (ej: `identity`, `catalog`).
   * Módulos opcionales o condicionales (ej: `inventory`, `warehousing` si hay stock físico).
4. **Catálogo de Tiers y Límites (`ModuleTierCatalog`):**
   * Métrica de consumo o cupo mensual por nivel (`Small`, `Medium`, `Big`, `Enterprise`).
   * Límites mínimos, estándar y enterprise.
5. **Permisos RBAC Habilitados (`identity.permissions`):**
   * Lista exhaustiva de los permisos creados en backend y frontend para ese módulo.
6. **Rutas y Navegación SPA:**
   * Rutas desbloqueadas en `ecunexo_admin` al estar el módulo en `enabledModules`.

---

## 3. Plantilla Canónica del Prompt de Licenciamiento

El bloque que el agente debe emitir debe seguir exactamente este formato:

````markdown
```text
================================================================================
SOLICITUD DE REGISTRO DE NUEVO MÓDULO EN EL SUBSISTEMA DE LICENCIAS ECUNEXO
================================================================================

Hola agente de Licenciamiento / Core Tenancy,

Se ha desarrollado y verificado un nuevo módulo funcional en EcuNexo. A continuación se proporcionan todos los metadatos técnicos, dependencias, límites y permisos para su incorporación en el motor de licencias, cálculo de entitlements y emisión de licencias criptográficas:

1. IDENTIFICACIÓN DEL MÓDULO
--------------------------------------------------------------------------------
- Código Técnico (ModuleCode): [código_en_minúsculas] (ej: purchases)
- Nombre Comercial: [Nombre Comercial Completo]
- Categoría / Área: [Operaciones / Fiscal / Comercial / Logística]
- Descripción Funcional: [Descripción concisa del alcance del módulo]

2. GRAFO DE DEPENDENCIAS (ModuleDependencyGraph)
--------------------------------------------------------------------------------
- Módulos Requeridos (Hard Dependencies):
  * identity (Obligatorio en todo tenant)
  * [otro módulo base, ej: catalog]
- Módulos Opcionales / Recomendados:
  * [ej: inventory y warehousing si gestiona inventario físico]
- Incompatibilidades o Restricciones:
  * [ej: No opera sin catálogo activo]

3. TIERS Y LÍMITES TRANSACCIONALES (ModuleTierCatalog)
--------------------------------------------------------------------------------
Definir los límites sugeridos para cada nivel de suscripción:

| Métrica / Clave de Límite | Small (Básico) | Medium (Pyme) | Big (Estándar) | Enterprise (Corp) |
| :--- | :--- | :--- | :--- | :--- |
| [clave_limite_1, ej: max_monthly_records] | [valor] | [valor] | [valor] | Ilimitado (-1) |
| [clave_limite_2, ej: max_directory_items] | [valor] | [valor] | [valor] | Ilimitado (-1) |

4. PERMISOS RBAC DEL MÓDULO (identity.permissions)
--------------------------------------------------------------------------------
Permisos asociados al módulo que deben habilitarse en el rol Administrador del tenant cuando el módulo figure en enabledModules o entitlements:
- [modulo].[recurso].read: [Descripción breve]
- [modulo].[recurso].manage: [Descripción breve]
...

5. RUTAS DESBLOQUEADAS EN SPA (ecunexo_admin)
--------------------------------------------------------------------------------
- Rutas front-end condicionadas por enabledModules:
  * /[modulo]/[ruta_1]
  * /[modulo]/[ruta_2]

6. TAREAS TÉCNICAS A REALIZAR EN EL REPOSITORIO DE LICENCIAS
--------------------------------------------------------------------------------
1. Agregar constante a `TenantModuleCodes.cs`:
   `public const string [NombrePascal] = "[codigo_modulo]";` y sumarlo al array `All`.
2. Registrar en `ModuleDependencyGraph.cs`:
   `AddRule(TenantModuleCodes.[NombrePascal], [TenantModuleCodes.Identity, ...]);`
3. Registrar defaults en `ModuleTierCatalog.cs` para los 4 tiers.
4. Actualizar `ModulePermissionFilter.cs` y seed de permisos si aplica.
5. Permitir la emisión y reemisión de licencias (.lic) que contengan este módulo en `enabledModules`.
================================================================================
```
````

---

## 4. Checklist para el Agente al Redactar el Prompt

* [ ] El `ModuleCode` es único, en minúsculas y sin caracteres especiales.
* [ ] Se revisaron los permisos reales implementados en el código de backend (`Endpoints`, `MenuCatalogSeedData.cs`).
* [ ] Se especificaron dependencias reales del modelo de dominio.
* [ ] Los límites por tier son realistas para la escala del mercado ecuatoriano (PyME vs Empresa).
* [ ] Se especifican las rutas reales de la SPA que controla el `TenantSessionGate` o el sidebar.
