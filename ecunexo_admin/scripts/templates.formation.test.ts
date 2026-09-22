import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDimensionValuesMap,
  findDuplicateSkuValues,
  getModelAttributeFields,
  getVariantAttributeFields,
  resolvePhotoScope,
  resolveTemplateDimensions,
} from '../src/lib/catalogArchetype.ts'
import type { ProductTemplateLevel, VariantDimensionTemplateDto } from '../src/types/catalogApi.ts'

function dict(
  name: string,
  values: string[],
  opts: { color?: boolean; size?: boolean; axis?: boolean } = {}
): VariantDimensionTemplateDto {
  const dimensionType = opts.color ? 'color' : opts.size ? 'size' : 'custom'
  return {
    id: `dict-${name}`,
    tenantId: 'tenant-test',
    name,
    dimensionType,
    predefinedValuesJson: JSON.stringify(values),
    isSystemDefault: false,
    dataType: opts.color ? 'color' : 'text',
    isVariantAxis: opts.axis ?? true,
    unit: null,
  }
}

const buildDictionary = () =>
  buildDimensionValuesMap([
    dict('Tallas', ['39-41', '42-44', '45-47'], { size: true }),
    dict('Color', [], { color: true }),
    dict('Tipo de Caña', ['Caña Alta', 'Caña Corta']),
    dict('Medias / Calcetines', ['35-38', '39-41', '42-44', '45-47', '48-50'], { size: true }),
    dict('Largo', ['Corto', 'Medio', 'Largo']),
    dict('Presentación', ['500 g', '1 kg']),
    dict('Sabor', ['Chocolate', 'Vainilla']),
    dict('Marca', ['Nike'], { axis: false }),
    dict('Material', ['Algodón'], { axis: false }),
    dict('Coleccion', ['Runner 2026'], { axis: false }),
    dict('Categoria Calcetin', ['Calcetines'], { axis: false }),
    dict('Tipo Calcetín', ['Deportivo'], { axis: false }),
  ])

type Caso = {
  nombre: string
  niveles: ProductTemplateLevel[]
  ejes: string[]
  gruposFoto: string[]
  fichaModelo: string[]
  valoresPorEje: number[]
}

const casos: Caso[] = [
  {
    nombre: '1D — Talla',
    niveles: [
      { id: 'l1', name: 'Variante', hasColor: false, hasImages: true, photoScope: 'variant', attributes: ['Tallas'] },
    ],
    ejes: ['Tallas'],
    gruposFoto: [],
    fichaModelo: [],
    valoresPorEje: [3],
  },
  {
    nombre: '2D — Talla × Color (galería por color)',
    niveles: [
      { id: 'l1', name: 'Modelo', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca', 'Material'] },
      {
        id: 'l2',
        name: 'Variante',
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Color'],
        attributes: ['Tallas'],
      },
    ],
    ejes: ['Tallas', 'Color'],
    gruposFoto: ['Color'],
    fichaModelo: ['Marca', 'Material'],
    valoresPorEje: [3, 3],
  },
  {
    nombre: '3D — Talla × Caña × Color (galería por caña+color)',
    niveles: [
      { id: 'l1', name: 'Producto', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca', 'Material'] },
      {
        id: 'l2',
        name: 'Variante',
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Tipo de Caña', 'Color'],
        attributes: ['Tallas', 'Tipo de Caña'],
      },
    ],
    ejes: ['Tallas', 'Tipo de Caña', 'Color'],
    gruposFoto: ['Tipo de Caña', 'Color'],
    fichaModelo: ['Marca', 'Material'],
    valoresPorEje: [3, 2, 3],
  },
  {
    nombre: '4D — Talla × Caña × Largo × Color',
    niveles: [
      { id: 'l1', name: 'Producto', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca', 'Material'] },
      {
        id: 'l2',
        name: 'Variante',
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Tipo de Caña', 'Largo', 'Color'],
        attributes: ['Tallas', 'Tipo de Caña', 'Largo'],
      },
    ],
    ejes: ['Tallas', 'Tipo de Caña', 'Largo', 'Color'],
    gruposFoto: ['Tipo de Caña', 'Largo', 'Color'],
    fichaModelo: ['Marca', 'Material'],
    valoresPorEje: [3, 2, 3, 3],
  },
  {
    nombre: '6 niveles — Calcetines (N1-N4 ficha, N5 tallas, N6 variante)',
    niveles: [
      { id: 'l1', name: 'Tipo Ítem', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Tipo Calcetín'] },
      { id: 'l2', name: 'Colección Ítem', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Coleccion'] },
      { id: 'l3', name: 'Categoría Ítem', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Categoria Calcetin'] },
      { id: 'l4', name: 'Producto / Ítem', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca', 'Material'] },
      { id: 'l5', name: 'Tallas', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Tallas'] },
      {
        id: 'l6',
        name: 'Variante Física',
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Tipo de Caña', 'Color'],
        attributes: ['Tipo de Caña'],
      },
    ],
    ejes: ['Tallas', 'Tipo de Caña', 'Color'],
    gruposFoto: ['Tipo de Caña', 'Color'],
    fichaModelo: ['Tipo Calcetín', 'Coleccion', 'Categoria Calcetin', 'Marca', 'Material'],
    valoresPorEje: [3, 2, 3],
  },
  {
    nombre: '2D — Automático sin photoGroupBy (group agrupa todo eje no-talla)',
    niveles: [
      { id: 'l1', name: 'Modelo', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca'] },
      { id: 'l2', name: 'Variante', hasColor: true, hasImages: true, photoScope: 'group', attributes: ['Tallas'] },
    ],
    ejes: ['Tallas', 'Color'],
    gruposFoto: ['Color'],
    fichaModelo: ['Marca'],
    valoresPorEje: [3, 3],
  },
  {
    nombre: '2D — Medias / Calcetines (escala size) × Color: la talla no se agrupa',
    niveles: [
      { id: 'l1', name: 'Modelo', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca'] },
      {
        id: 'l2',
        name: 'Variante',
        hasColor: true,
        hasImages: true,
        photoScope: 'group',
        attributes: ['Medias / Calcetines'],
      },
    ],
    ejes: ['Medias / Calcetines', 'Color'],
    gruposFoto: ['Color'],
    fichaModelo: ['Marca'],
    valoresPorEje: [5, 3],
  },
  {
    nombre: '2D — Otro rubro (Sabor × Presentación)',
    niveles: [
      { id: 'l1', name: 'Producto', hasColor: false, hasImages: false, photoScope: 'none', attributes: ['Marca'] },
      {
        id: 'l2',
        name: 'Variante',
        hasColor: false,
        hasImages: true,
        photoScope: 'group',
        photoGroupBy: ['Sabor', 'Presentación'],
        attributes: ['Sabor', 'Presentación'],
      },
    ],
    ejes: ['Sabor', 'Presentación'],
    gruposFoto: ['Sabor', 'Presentación'],
    fichaModelo: ['Marca'],
    valoresPorEje: [2, 2],
  },
]

for (const caso of casos) {
  test(caso.nombre, () => {
    const dimensiones = resolveTemplateDimensions(caso.niveles, buildDictionary())

    assert.ok(dimensiones, 'La plantilla debe derivar dimensiones')
    assert.deepEqual(dimensiones.map((d) => d.name), caso.ejes, 'Ejes derivados')
    assert.deepEqual(
      dimensiones.filter((d) => d.photoGroup).map((d) => d.name),
      caso.gruposFoto,
      'Ejes que comparten fotos'
    )
    assert.deepEqual(
      getModelAttributeFields(caso.niveles, buildDictionary()).map((f) => f.key),
      caso.fichaModelo,
      'Ficha del modelo'
    )

    const esperado = caso.valoresPorEje.reduce((acc, n) => acc * n, 1)
    const real = dimensiones.reduce((acc, dim, idx) => acc * caso.valoresPorEje[idx], 1)
    assert.equal(real, esperado, 'Cardinalidad del producto cartesiano')

    const scope = resolvePhotoScope(caso.niveles)
    assert.ok(['variant', 'group', 'model'].includes(scope), 'Alcance fotográfico válido')

    console.log(
      `  ${caso.nombre}\n    alcance: ${scope} · ejes: ${dimensiones.length}D [${caso.ejes.join(' × ')}]` +
        `\n    galerías compartidas: ${caso.gruposFoto.join(' + ') || '—'} · variantes: ${real}` +
        `\n    ficha modelo: ${caso.fichaModelo.join(', ') || '—'}`
    )
  })
}

test('SKUs duplicados: detecta repeticiones ignorando mayúsculas y espacios', () => {
  assert.deepEqual(findDuplicateSkuValues(['NIK-001', ' nik-001 ', 'NIK-002']), ['NIK-001'])
  assert.deepEqual(findDuplicateSkuValues(['NIK-001', 'NIK-002', 'nik-001']), ['NIK-001'])
})

test('SKUs duplicados: ignora vacíos y no reporta falsos positivos', () => {
  assert.deepEqual(findDuplicateSkuValues(['NIK-001', '', '  ', 'NIK-002']), [])
  assert.deepEqual(findDuplicateSkuValues([]), [])
})

test('SKUs duplicados: reporta cada valor repetido una sola vez', () => {
  assert.deepEqual(findDuplicateSkuValues(['A', 'A', 'a', 'B', 'B']), ['A', 'B'])
})

test('Atributo descriptivo del terminal se captura por variante y sale de la ficha del modelo', () => {
  const levels: ProductTemplateLevel[] = [
    {
      id: 'l1',
      name: 'Producto',
      hasColor: false,
      hasImages: false,
      attributes: ['Marca'],
      photoScope: 'none',
    },
    {
      id: 'l2',
      name: 'Variantes',
      hasColor: false,
      hasImages: false,
      attributes: ['Tallas', 'Actividad / Uso'],
      photoScope: 'none',
    },
  ]
  const map = buildDimensionValuesMap([
    dict('Tallas', ['S', 'M'], { size: true }),
    dict('Actividad / Uso', ['Running', 'Crossfit'], { axis: false }),
    dict('Marca', ['Nike'], { axis: false }),
  ])

  assert.deepEqual(
    getVariantAttributeFields(levels, map).map((f) => f.key),
    ['Actividad / Uso'],
    'El descriptivo del terminal se captura por variante'
  )
  assert.deepEqual(
    getModelAttributeFields(levels, map).map((f) => f.key),
    ['Marca'],
    'La ficha del modelo no duplica el atributo de variante'
  )
})
