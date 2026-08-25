---
title: Modelo de negocio — Ecuador
tags: [ecunexo, negocio, ecuador]
---

# Modelo de negocio — Ecuador

## Segmentos

| Código | Perfil | Despliegue | Empresas | Dolor principal |
|--------|--------|------------|----------|-----------------|
| **S1** | PYME retail / bodega | Cloud Ecunexo | 1 | Precio bajo, rápido de usar |
| **S2** | PYME con facturación SRI | Cloud o híbrido | 1 | Conectividad intermitente, cola facturas |
| **S3** | Distribuidor / holding | Cloud o on-prem | Varias | Varias razones sociales, un contrato |
| **S4** | Corporativo privado | On-prem | 1..N | Datos en casa, sin salida a internet operativa |

## Modalidades de despliegue

| Modo | Quién hospeda BD/API | Licencia |
|------|----------------------|----------|
| **CloudShared** | Ecunexo | Código o provisión directa en cloud |
| **CustomerHosted** | Cliente | Código insertado en su BD / paquete instalación |
| **HybridEdge** | Cliente (BD local) | Igual on-prem; plan con `invoicing` + futuro sync |

## Módulos de producto (venta)

| Módulo comercial | Código técnico `TenantModuleCodes` |
|------------------|-----------------------------------|
| Inventario | `inventory` |
| Bodegas | `warehousing` |
| Facturación | `invoicing` |
| E-commerce / catálogo | `catalog` |
| Identidad / admin (base) | `identity` (incluido en todos los planes de pago) |

## Propuesta de valor Ecuador

- Facturación electrónica y operación con **cortes de internet** (perfil S2).
- Inventario + bodega para comercio mayorista/minorista (S1).
- Holdings con varias marcas o sucursales legales separadas (S3).
- Precios en **USD** (dolarizado); facturación mensual/anual con descuento anual.

## Enlaces

- [[02-planes-y-precios-ecuador]]
- [[06-flujos-onprem-cloud-hibrido]]
- [[10-modelo-titular-suscripcion-rbac]]
