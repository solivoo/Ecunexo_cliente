---
name: ui-vistas-sobre-modales
description: >-
  Estándar de arquitectura y diseño UI/UX para priorizar páginas/vistas completas
  y rutas dedicadas sobre modales o popups al crear interfaces en EcuNexo.
  Los modales quedan estrictamente restringidos a micro-interacciones de poco contenido
  (confirmaciones, alertas o formularios de 1-2 campos simples).
---

# UI/UX: Vistas Dedicadas sobre Modales en EcuNexo

Esta directriz establece el principio de arquitectura frontend y experiencia de usuario (UX) para la creación y refactorización de interfaces en EcuNexo: **Priorizar siempre páginas y vistas completas con ruta propia en lugar de ventanas modales (`Popup`), reservando los modales exclusivamente para micro-interacciones de mínimo contenido.**

---

## 1. Principio Fundamental

> **"Vistas y Rutas Dedicadas por Defecto; Modales Únicamente por Excepción Justificada."**

Los sistemas empresariales complejos y ERPs sufren una degradación severa de experiencia de usuario cuando los formularios y flujos operativos se comprimen dentro de ventanas modales:
- **Pérdida de contexto y claustrofobia visual:** Campos amontonados, scrollbars internos dobles y selectores cortados por los límites del diálogo emergente.
- **Riesgo crítico de pérdida de datos:** Un clic accidental en el backdrop (fondo oscuro) o presionar `Escape` puede cerrar el modal y destruir el trabajo del usuario.
- **Imposibilidad de multi-tarea y enlaces directos:** Un modal no tiene URL en el router (`/nueva`, `/editar/:id`), impidiendo compartir enlaces, recargar la página o volver atrás con el historial del navegador.
- **Pobre adaptabilidad responsive:** En pantallas portátiles o tablets, los modales grandes superan la altura del viewport y ocultan los botones de acción primarios.

---

## 2. Matriz de Decisión: ¿Vista o Modal?

| Escenario de UI / Contenido | Formato Obligatorio | Justificación |
| :--- | :---: | :--- |
| **Creación o Edición con 3+ campos** | 📄 **Vista Dedicada (`Page`)** | Espacio ergonómico, labels visibles, validaciones claras y layout M3. |
| **Formularios con tablas o líneas hijas** (Facturas, Liquidaciones, Compras, Proformas, Asientos, Traspasos) | 📄 **Vista Dedicada (`Page`)** | Requiere ancho completo para columnas de cantidad, precio, IVA, totales y acciones. |
| **Flujos de Importación / Auditoría** (XMLs SRI, Conciliación bancaria, Importación Excel) | 📄 **Vista Dedicada (`Page`)** | Necesita cola de trabajo, previsualización, auditoría y desglose de errores. |
| **Reportes, Balances y Dashboards** (P&G, Balance General, Kárdex, Liquidaciones) | 📄 **Vista Dedicada (`Page`)** | Requiere filtros de fechas, KPIs analíticos, DataGrid y exportación. |
| **Confirmación de Acción Destructiva** (ej: "¿Eliminar cuenta contable?", "¿Anular comprobante?") | 🪟 **Modal Breve (`Popup`)** | Alerta focalizada de 1 clic que previene errores sin desviar al usuario de la pantalla. |
| **Micro-interacción de 1 o 2 campos** (ej: "Ingresar motivo de rechazo", "Asignar tag rápido") | 🪟 **Modal Breve (`Popup`)** | Captura rápida sin justificar la creación de una página ni cambio de ruta. |
| **Visor de Documento RIDE / PDF** | 🪟 **Modal o Pestaña Nueva** | Previsualización puntual donde el usuario solo desea inspeccionar e imprimir/descargar. |

---

## 3. Anatomía Estándar de una Vista Dedicada (`Page`)

Cuando se construya una vista dedicada de creación, edición o proceso, debe seguir la estructura canónica de EcuNexo con `PageHeader`, `SectionCard` y navegación de retorno:

```tsx
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'

export function MiEntidadCreatePage() {
  const navigate = useNavigate()

  return (
    <TenantSessionGate title="Nuevo Registro" lead="Descripción del proceso">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo Registro de Entidad"
          subtitle="Formulario completo para dar de alta la entidad en el sistema"
          badge={<StatusBadge tone="primary" withDot>Operación</StatusBadge>}
          actions={
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/modulo/listado')}
              >
                <ArrowLeft size={16} />
                Volver
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
              >
                <Save size={16} />
                Guardar Registro
              </Button>
            </div>
          }
        />

        {/* Secciones temáticas limpias */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionCard title="1. Datos Generales" subtitle="Información básica obligatoria">
            <div className="ecu-customer-form__grid">
              {/* Inputs Glubox */}
            </div>
          </SectionCard>

          <SectionCard title="2. Detalle de Ítems / Operación" subtitle="Líneas y cálculo de importes">
            {/* Tabla interactiva */}
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
```

---

## 4. Registro Obligatorio en Enrutador (`routes.tsx`)

Cada vista dedicada debe quedar enlazada con su ruta RESTful en `routes.tsx`:
- Listado: `/modulo/entidades` (ej: `/compras/liquidaciones`)
- Creación: `/modulo/entidades/nueva` (ej: `/compras/liquidaciones/nueva`)
- Detalle/Edición: `/modulo/entidades/:id` (ej: `/ecommerce/pedidos/:orderId`)

---

## 5. Reglas Invariables para Agentes y Desarrolladores

1. **NO crear modales para flujos de negocio principales:** Nunca empaquetar formularios de facturas, liquidaciones, compras, proformas, pólizas o asientos contables en un `<Popup>` flotante.
2. **Si una vista existente usa un modal pesado:** Proponer y refactorizar hacia una página dedicada con `/nueva` o `/editar/:id`.
3. **El modal solo se reserva para:**
   - Confirmaciones de borrado (`¿Desea eliminar...?`).
   - Inputs individuales de confirmación (`Motivo de cancelación`).
   - Visores rápidos de archivos adjuntos o previsualizaciones puntuales de impresión.
