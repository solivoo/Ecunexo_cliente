---
name: semantic-versioning
description: >-
  Use this skill automatically upon completing any modification, feature, bug fix, or refactor
  in EcuNexo. Automatically evaluates changes, bumps the semantic version (MAJOR.MINOR.PATCH)
  in package.json, synchronizes the About modal changelog, and verifies tests without requiring
  the user to manually request a version update.
---

# Semantic Versioning & Automated Release Lifecycle (EcuNexo)

Este skill define el procedimiento autónomo y estándar de versionamiento semántico (**SemVer 2.0.0**) para el ecosistema EcuNexo (`ecunexo_admin` y `ecunexo_api`).

> [!IMPORTANT]
> **REGLA DE CERO ESPERA (Zero-Prompt Automation)**:
> El agente **NUNCA** debe esperar a que el usuario solicite *"actualiza la versión"* ni debe preguntar si debe incrementarla. Todo conjunto de cambios finalizado y listo para commit/push debe tener su versión calculada e incrementada de forma proactiva.

---

## 1. Clasificación del Incremento de Versión

Analizar la naturaleza de los cambios implementados (`git status`, `git diff --stat`) y aplicar la siguiente taxonomía:

| Tipo | Impacto SemVer | Ejemplos en EcuNexo | Prefijos Convencionales |
| :--- | :--- | :--- | :--- |
| **PATCH** | `x.y.Z` $\rightarrow$ `x.y.(Z+1)` | • Corrección de bugs o errores de consola/red.<br>• Ajustes visuales, gaps, padding o contrastes dark mode.<br>• Eliminación de botones duplicados en toolbars/headers.<br>• Corrección de validaciones menores o textos en vistas existentes.<br>• Optimización de consultas sin alterar contratos. | `fix:`, `perf:`, `style:`, `refactor:`, `test:`, `chore:` |
| **MINOR** | `x.Y.z` $\rightarrow$ `x.(Y+1).0` | • Nueva vista, página o módulo (ej: Directorio de Clientes `/taller/clientes`).<br>• Nuevo flujo funcional (ej: Previsualización de lotes, Anulación con auditoría).<br>• Nuevos endpoints REST en el backend retrocompatibles.<br>• Integración de nuevos algoritmos fiscales (ej: Validador SRI Módulo 10/11).<br>• Generación de reportes o firmas criptográficas con QR. | `feat:`, `feat(scope):` |
| **MAJOR** | `X.y.z` $\rightarrow$ `(X+1).0.0` | • Cambios con rotura de compatibilidad (Breaking Changes) en contratos de API.<br>• Migraciones destructivas de base de datos o cambio de esquema no compatible.<br>• Reemplazo radical de arquitectura base o eliminación de módulos existentes. | `BREAKING CHANGE:`, `feat!:`, `fix!:` |

---

## 2. Fuente Única de Verdad (Single Source of Truth)

En EcuNexo, la versión visualizada en toda la plataforma se alimenta dinámicamente de `ecunexo_admin/package.json`:
1. `vite.config.ts` lee `package.json.version` y la inyecta como `__APP_VERSION__`.
2. `src/config/appVersion.ts` expone `APP_VERSION_INFO.version`.
3. Se refleja automáticamente en:
   - Sidebar inferior: `app-shell__version-tag` (`DashboardLayout.tsx`).
   - Menú de usuario superior: `app-shell__user-menu-version-pill` (`AppShellUserMenu.tsx`).
   - Modal "Acerca de EcuNexo": `ecu-about-modal__badge` (`AboutAppModal.tsx`).
   - Sección de Sistema en Configuración: `AppSettingsSystemSection.tsx`.
   - Diagnósticos de soporte copiables: `buildSupportDiagnostics()`.

---

## 3. Protocolo de Ejecución Paso a Paso

Al concluir cualquier requerimiento o bloque de trabajo:

### Paso 1: Determinar el tipo de cambio
Revisar los archivos modificados con `git status` y clasificar si corresponde a **PATCH**, **MINOR** o **MAJOR**.

### Paso 2: Incrementar la versión
Actualizar el atributo `"version"` en `ecunexo_admin/package.json`.
* Ejemplo: si la versión actual es `0.7.0` y se añadió el nuevo Directorio de Clientes (`feat`), la nueva versión es `0.8.0`.
* Si seguidamente se corrige un bug de alineación o duplicación (`fix`), la nueva versión es `0.8.1`.

### Paso 3: Actualizar el Changelog en el Modal Acerca de
Si el cambio es **MINOR** o introduce capacidades clave para el usuario:
- Abrir `ecunexo_admin/src/components/about/AboutAppModal.tsx`.
- Actualizar el título del changelog si aplica (`Novedades vX.Y.Z`).
- Añadir o actualizar un `<li><strong>...:</strong> ...</li>` describiendo la nueva funcionalidad de forma concisa y profesional.

### Paso 4: Validar Pruebas y Compilación
- Comprobar que las pruebas E2E no tengan hardcodeada una versión fija (utilizar `pkg.version` o expresión regular `v\d+\.\d+\.\d+`).
- Ejecutar `npm run build` en `ecunexo_admin`.
- Si hubo cambios en backend, ejecutar `dotnet test` en `ecunexo_api`.
- Si hubo cambios en pantallas cubiertas por Playwright, ejecutar la suite UI correspondiente.

### Paso 5: Mensaje de Commit Estructurado
El commit debe reflejar la versión bumped en el encabezado o descripción:
```bash
git commit -m "feat(clientes): directorio centralizado de clientes con validacion SRI ecuatoriana (v0.8.0)"
# o
git commit -m "fix(ui): resolucion de botones duplicados y espaciado en barra de acciones (v0.8.1)"
```

---

## 4. Pruebas Automatizadas y Versionado Resiliente

Para evitar fallas en CI o pruebas locales al incrementar versiones:
* En archivos de prueba como `enterprise-shell-ui.spec.ts`:
  ```ts
  import pkg from '../../package.json'
  // Correcto:
  await expect(modal.locator('.ecu-about-modal__badge')).toContainText(`v${pkg.version}`)
  // O mediante expresión regular:
  await expect(modal.locator('.ecu-about-modal__badge')).toContainText(/v\d+\.\d+\.\d+/)
  ```
* **NUNCA** escribir strings fijos como `toContainText('v0.7.0')` en assertions de pruebas que verifiquen la versión del sistema.
