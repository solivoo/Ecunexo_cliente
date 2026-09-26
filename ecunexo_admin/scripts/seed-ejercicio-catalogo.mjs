#!/usr/bin/env node
/**
 * Ejercicio de catálogo: plantillas + productos con estructuras distintas.
 *
 * Uso:
 *   TENANT_ID=<guid> TOKEN=<jwt> [API_BASE=http://127.0.0.1:5088] \
 *     node scripts/seed-ejercicio-catalogo.mjs
 *
 * Requiere permisos catalog.item.create y gestión de plantillas.
 */

const API = (process.env.API_BASE || 'http://127.0.0.1:5088').replace(/\/+$/, '')
const TENANT = process.env.TENANT_ID
const TOKEN = process.env.TOKEN

if (!TENANT || !TOKEN) {
  console.error('Faltan TENANT_ID y TOKEN en el entorno.')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }
  return data
}

function level(partial) {
  return {
    id: partial.id,
    name: partial.name,
    hasColor: Boolean(partial.hasColor),
    hasImages: Boolean(partial.hasImages),
    attributes: partial.attributes ?? [],
    axes: partial.axes ?? [],
    photoScope: partial.photoScope ?? 'none',
    photoGroupBy: partial.photoGroupBy ?? [],
  }
}

const templates = [
  {
    key: 'repuesto',
    name: 'Ejercicio · Repuesto simple',
    description: 'Ficha con datos; un solo código.',
    levels: [
      level({
        id: 'r1',
        name: 'Modelo',
        attributes: ['Marca', 'Referencia'],
        axes: [],
        photoScope: 'model',
        hasImages: true,
      }),
    ],
  },
  {
    key: 'calcetines',
    name: 'Ejercicio · Calcetines deportivos',
    description: 'Colección › Modelo › Talla × Caña × Color. Fotos por color.',
    levels: [
      level({ id: 'c1', name: 'Colección', attributes: ['Deporte'], axes: [] }),
      level({ id: 'c2', name: 'Modelo', attributes: ['Marca', 'Material'], axes: [] }),
      level({
        id: 'c3',
        name: 'Variaciones',
        attributes: [],
        axes: ['Tallas', 'Tipo de Caña', 'Color'],
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Color'],
      }),
    ],
  },
  {
    key: 'camisas',
    name: 'Ejercicio · Camisas',
    description: 'Modelo › Talla × Manga × Color. Fotos por color.',
    levels: [
      level({ id: 'm1', name: 'Modelo', attributes: ['Tela', 'Corte'], axes: [] }),
      level({
        id: 'm2',
        name: 'Variaciones',
        attributes: [],
        axes: ['Tallas', 'Largo de Manga', 'Color'],
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Color'],
      }),
    ],
  },
  {
    key: 'aceites',
    name: 'Ejercicio · Aceites',
    description: 'Presentación › Sabor × Contenido.',
    levels: [
      level({
        id: 'a1',
        name: 'Presentación',
        attributes: ['Marca'],
        axes: ['Sabor', 'Contenido'],
        hasImages: true,
        photoScope: 'model',
      }),
    ],
  },
]

function cartesian(dims) {
  return dims.reduce(
    (acc, dim) => acc.flatMap((row) => dim.values.map((v) => ({ ...row, [dim.name]: v }))),
    [{}]
  )
}

function skuFrom(prefix, combo) {
  return `${prefix}-${Object.values(combo)
    .map((v) =>
      String(v)
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 8)
    )
    .join('-')}`
}

async function ensureTemplate(def) {
  const existing = await api('GET', `/api/v1/tenants/${TENANT}/catalog/product-templates`)
  const found = (existing || []).find((t) => t.name === def.name)
  if (found) {
    console.log(`  plantilla ya existe: ${def.name}`)
    return found.id
  }
  const created = await api('POST', `/api/v1/tenants/${TENANT}/catalog/product-templates`, {
    name: def.name,
    description: def.description,
    hierarchyTreeJson: JSON.stringify(def.levels),
    isActive: true,
  })
  console.log(`  plantilla creada: ${def.name}`)
  return created.id
}

async function createService() {
  const created = await api('POST', `/api/v1/tenants/${TENANT}/catalog/items`, {
    kind: 1,
    name: 'Asesoría contable mensual',
    description: 'Paquete mensual de revisión y asesoría tributaria.',
    sku: null,
    basePrice: 80,
    customAttributesJson: null,
  })
  console.log('  servicio:', created.itemId)
}

async function createSingleSku(familyId) {
  const created = await api('POST', `/api/v1/tenants/${TENANT}/catalog/items`, {
    kind: 0,
    name: 'Filtro de aceite OEM',
    description: 'Filtro compatible OEM.',
    sku: 'FILT-OEM-001',
    basePrice: 12.5,
    customAttributesJson: JSON.stringify({ Marca: 'Bosch', Referencia: 'OF-451' }),
    familyId,
    hierarchyPathJson: JSON.stringify([
      { level: 'Modelo', name: 'Marca', value: 'Bosch' },
      { level: 'Modelo', name: 'Referencia', value: 'OF-451' },
    ]),
  })
  console.log('  repuesto:', created.itemId)
}

async function createMatrix({ name, familyId, hierarchyPath, dims, skuPrefix, price, attrs }) {
  const combos = cartesian(dims)
  const variantDimensionsJson = JSON.stringify(
    dims.map((d) => ({
      name: d.name,
      values: d.values,
      type: d.type || 'custom',
      ...(d.photoGroup ? { photoGroup: true } : {}),
    }))
  )
  const variants = combos.map((combo) => ({
    variantTitle: Object.values(combo).join(' / '),
    sku: skuFrom(skuPrefix, combo),
    basePrice: price,
    customAttributesJson: JSON.stringify(combo),
  }))

  const created = await api('POST', `/api/v1/tenants/${TENANT}/catalog/items/matrix`, {
    kind: 0,
    name,
    description: null,
    modelCode: null,
    basePrice: price,
    variantDimensionsJson,
    variants,
    customAttributesJson: JSON.stringify(attrs),
    familyId,
    hierarchyPathJson: JSON.stringify(hierarchyPath),
  })
  console.log(`  matriz «${name}»: padre ${created.parentItemId} · ${created.createdVariantsCount} variantes`)
}

async function main() {
  console.log(`API ${API} · tenant ${TENANT}`)
  console.log('Plantillas…')
  const ids = {}
  for (const tpl of templates) {
    ids[tpl.key] = await ensureTemplate(tpl)
  }

  console.log('Productos…')
  await createService()
  await createSingleSku(ids.repuesto)

  await createMatrix({
    name: 'Calcetín Runner Algodón',
    familyId: ids.calcetines,
    hierarchyPath: [
      { level: 'Colección', name: 'Deporte', value: 'Running' },
      { level: 'Modelo', name: 'Marca', value: 'Nike' },
      { level: 'Modelo', name: 'Material', value: 'Algodón' },
    ],
    attrs: { Deporte: 'Running', Marca: 'Nike', Material: 'Algodón' },
    dims: [
      { name: 'Tallas', values: ['35-38', '39-41'], type: 'size' },
      { name: 'Tipo de Caña', values: ['Corta', 'Media'], type: 'custom' },
      { name: 'Color', values: ['Negro', 'Blanco'], type: 'color', photoGroup: true },
    ],
    skuPrefix: 'CALC-RUN',
    price: 3.5,
  })

  await createMatrix({
    name: 'Camisa Oxford Manga',
    familyId: ids.camisas,
    hierarchyPath: [
      { level: 'Modelo', name: 'Tela', value: 'Oxford' },
      { level: 'Modelo', name: 'Corte', value: 'Regular' },
    ],
    attrs: { Tela: 'Oxford', Corte: 'Regular' },
    dims: [
      { name: 'Tallas', values: ['S', 'M', 'L'], type: 'size' },
      { name: 'Largo de Manga', values: ['Corta', 'Larga'], type: 'custom' },
      { name: 'Color', values: ['Blanco', 'Azul'], type: 'color', photoGroup: true },
    ],
    skuPrefix: 'CAM-OXF',
    price: 28,
  })

  await createMatrix({
    name: 'Aceite de oliva gourmet',
    familyId: ids.aceites,
    hierarchyPath: [{ level: 'Presentación', name: 'Marca', value: 'Extra Virgen' }],
    attrs: { Marca: 'Extra Virgen' },
    dims: [
      { name: 'Sabor', values: ['Clásico', 'Ajo'], type: 'custom' },
      { name: 'Contenido', values: ['250 ml', '500 ml'], type: 'custom' },
    ],
    skuPrefix: 'ACE-OLV',
    price: 9.9,
  })

  console.log('Listo. Revisa Catálogo → Ítems y Plantillas.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
