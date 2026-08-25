# Playwright — ensayos por plan

Una carpeta por plan. Lo que no depende del plan vive en `comun/`.

```
tests-ui/
  helpers/                 credenciales, matriz, sesión, ciclo de licencia
  comun/                   login, equipo, listados, toolbars
  planes/
    independiente/         Loma Soft — servicio + factura, sin stock
    local/                 Ferretería El Perno — 1 bodega, recepción, factura (sin SRI)
    taller/                Taller El Eje — 2 bodegas + tránsito, servicio y pieza
    empresa/               (pendiente)
    cadena/                (pendiente)
    grupo/                 (pendiente)
    con-inventario/        flujos compartidos Local…Grupo
    ciclo-licencia.spec.ts emitir → recorrer → borrar (opt-in)
```

## Credenciales

Fichas (RUC, cupos, qué no tocar): [`doc/ensayo-planes.md`](../../doc/ensayo-planes.md).

Copia `.env.local.example` a `.env.local` (no se commitea). Independiente, Local y Taller pueden convivir:

```
E2E_INDEPENDIENTE_EMAIL=gabriela.loma@ecunexo.test
E2E_INDEPENDIENTE_PASSWORD=LomaSoft2026!
E2E_INDEPENDIENTE_PLAN=pro-independiente

E2E_LOCAL_EMAIL=marco.andrade@ecunexo.test
E2E_LOCAL_PASSWORD=12345678
E2E_LOCAL_PLAN=local-comercio

E2E_TALLER_EMAIL=luis.paredes@ecunexo.test
E2E_TALLER_PASSWORD=EjeTaller2026!
E2E_TALLER_PLAN=taller-mixto
```

Los specs de Independiente usan `E2E_INDEPENDIENTE_*`; los de Local, `E2E_LOCAL_*`; los de Taller, `E2E_TALLER_*`. No vuelven a emitir la licencia.

## Cómo correr

Admin debe estar en **http://localhost:5173**. Platform (`ecunexo_license`) va en **5174** — si Platform ocupa 5173, Playwright reutiliza esa SPA y el login falla (Network Error / credenciales).

```bash
pnpm test:ui:independiente:headed   # Chrome real: ves clics y pantallas
pnpm test:ui:independiente:ui       # panel: clic un test en verde, luego un paso en Actions
pnpm test:ui:local                 # El Perno (Local)
pnpm test:ui:taller                 # El Eje (Taller)
pnpm test:ui:independiente          # headless
pnpm test:ui:report                 # abre el HTML del último run (http://localhost:9323)
pnpm test:ui:independiente:report   # corre Independiente y abre el reporte
pnpm test:ui:comun
```

El recuadro gris del panel (`about:blank`) no es el navegador. Para ver Loma Soft: elige un test que ya pasó (✓) y pulsa un paso (`goto`, `click`). Para verlo en vivo, usa `:headed`.

No uses `E2E_FASE4_EMIT=1` con Independiente: gasta el secuencial SRI y este plan no tiene stock.
