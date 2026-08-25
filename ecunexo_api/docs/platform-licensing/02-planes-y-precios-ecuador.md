---
title: Planes y precios — Ecuador (referencia)
tags: [ecunexo, precios, ecuador, planes]
---

# Planes y precios — Ecuador

> **Aviso:** cifras **orientativas** para diseño comercial. Validar con costos de infra, soporte y competencia. IVA 15% no incluido salvo indicación contraria.

## Matriz de planes

| Plan | Código técnico | Segmento | Empresas | Usuarios | Bodegas | Módulos | Despliegue | USD/mes | USD/año (−15%) |
|------|----------------|----------|----------|----------|---------|---------|------------|---------|----------------|
| **Independiente** | `pro-independiente` | M0 servicio | 1 | 2 | 0 | identity + catalog + facturación | Cloud | 27 | 275 |
| **Local** | `local-comercio` | M1 comercio | 1 | 3 | 1 | + inventario + bodega | Cloud | 42 | 428 |
| **Taller** | `taller-mixto` | M1–M2 mixto | 1 | 5 | 2 | iguales a Local | Cloud | 59 | 602 |
| **Empresa** | `empresa-pyme` | M2 PyME | 1 | 10 | 3 | iguales (cupo equipo/bodegas) | Cloud | 79 | 806 |
| **Cadena** | `cadena-retail` | M3 varios locales | 1 | 20 | 8 | iguales | Cloud | 129 | 1 315 |
| **Grupo** | `grupo-multi-ruc` | M4 varios RUC | 5 | 25 | 10 | iguales por empresa | Cloud | 199 | 2 030 |

Códigos retirados (inactivos en seed): `services-starter`, `starter-cloud`, `business-cloud`, `retail-edge`, `multi-empresa`.

## Add-ons (mensual USD)

| Add-on | Descripción | Precio |
|--------|-------------|--------|
| Empresa adicional | +1 slot `max_tenants` (holding) | +35 / empresa |
| Usuarios pack +5 | Sobre límite del plan | +15 |
| Bodega adicional | +1 `max_warehouses` | +10 |
| Módulo E-commerce | Si no está en plan | +25 |
| Soporte prioritario | SLA 4h laborables | +49 |
| Instalación on-prem | Puesta en marcha única | 500–1 500 (único) |

## Una empresa vs multiempresa

| | Una empresa | Multiempresa |
|---|-------------|--------------|
| **Licencia** | `max_tenants = 1` | `max_tenants = 5..50` |
| **Uso típico** | Un RUC, una marca | Holding, franquicia, varias razones sociales |
| **Panel** | Un `/t/{tenantId}` | Selector de empresa (roadmap) |
| **Precio** | Starter / Business | Multi + add-on por empresa |
| **On-prem** | Retail Edge / Enterprise | Enterprise + slots |

## Jerarquía comercial vs técnica

| Nivel comercial | Qué compra | Qué se emite en plataforma |
|-----------------|------------|---------------------------|
| Cliente (titular) | Contrato + plan | `platform.customers` (diseño) |
| Licencia | Derecho a canjear N veces | `activation_codes` / `license_grants` |
| Empresa (tenant) | Una razón social operativa | Canje → `tenancy.tenants` |
| Usuario admin | Primer usuario Administrador | Onboarding → `identity.users` |

## Descuentos sugeridos

- Pago anual: **15%** sobre mensual × 12.
- ONG / educación: caso a caso (−20%).
- Partner contable referidor: comisión 15% primer año.

## Enlaces

- [[07-mapeo-modulos-permisos]]
- [[04-api-licencias-diseno]]
- [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md)
