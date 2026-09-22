import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { makeSolidPng } from '../helpers/makeSolidPng'
import { selectGluOption } from '../helpers/gluSelect'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

const API_BASE = (process.env.VITE_API_BASE_URL ?? 'http://localhost:5088').replace(/\/+$/, '')

/** PNG 400×400 (resolución mínima que exige el backend para e-commerce). */
const PNG_400 = makeSolidPng(400, 400, [69, 127, 201])

type ApiSession = { token: string; tenantId: string }

type TemplateDto = { id: string; name: string; hierarchyTreeJson: string }
type VariantTemplateDto = { name: string; predefinedValuesJson: string }
type MatrixResponse = { parentItemId: string; createdVariantsCount: number; variantItemIds: string[] }
type ItemDetail = {
  matrixDescriptor: {
    depth: number
    groupValues: string[]
    axes: { name: string; type: string; isPhotoGroup: boolean }[]
  }
  variants: {
    sku: string
    dimensionValues: Record<string, string> | null
    imageInheritedFrom: string | null
    images: unknown[] | null
    tags: string[] | null
    extraColors: string[] | null
  }[]
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function readApiSession(page: Page): Promise<ApiSession> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('persist:ecunexo-tenant-auth')
    if (!raw) return { token: '', tenantId: '' }
    const bag = JSON.parse(raw) as Record<string, string>
    const parse = (key: string): string => {
      const value = bag[key]
      if (!value) return ''
      try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'string' ? parsed : ''
      } catch {
        return ''
      }
    }
    return { token: parse('accessToken'), tenantId: parse('tenantId') }
  })
}

async function getJson<T>(request: APIRequestContext, url: string, token: string): Promise<T> {
  const response = await request.get(url, { headers: authHeaders(token) })
  expect(response.ok(), `GET ${url} -> ${response.status()}`).toBeTruthy()
  return (await response.json()) as T
}

test.describe('Catálogo — Galería compartida por ejes visuales (Talla × Caña × Color)', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Crea la plantilla en la interfaz y forma la matriz con galería por caña+color heredada', async ({
    page,
    request,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    const stamp = Date.now()
    const run = stamp.toString(36).toUpperCase()
    const canaCode: Record<string, string> = { 'Caña Alta': 'AL', 'Caña Corta': 'CO' }
    const tallaDigits = (talla: string): string => talla.replace(/\D/g, '')
    const templateName = `E2E Calcetines ${stamp}`
    const itemName = `E2E Calcetín Runner ${stamp}`
    let createdTemplateId: string | null = null
    let createdItemId: string | null = null
    let createdVariantIds: string[] = []

    try {
      // 1) Plantilla por interfaz (Chromium: datos reales en el constructor)
      await page.goto('/catalogo/plantillas/nueva')
      await expect(page.getByRole('heading', { name: /Nueva Plantilla de Producto/i })).toBeVisible({
        timeout: 20_000,
      })

      await page.getByPlaceholder(/Calzado & Textil/).fill(templateName)

      await selectGluOption(page, 'attr-select-lvl-3', /Medias \/ Calcetines/)
      const customAttr = page.locator('#attr-custom-lvl-3')
      await customAttr.fill('Tipo de Caña')
      await customAttr.press('Enter')

      await page.locator('#has-color-lvl-3').check()
      await selectGluOption(page, 'photo-scope-lvl-2', 'Sin fotos')
      await selectGluOption(page, 'photo-scope-lvl-3', 'Compartidas por grupo')

      await page.getByTitle('Compartir fotos por «Color»').click()
      await page.getByTitle('Compartir fotos por «Tipo de Caña»').click()

      await page.getByRole('button', { name: /Guardar Plantilla/ }).click()
      await expect(page).toHaveURL(/\/catalogo\/plantillas$/, { timeout: 20_000 })
      await expect(page.getByText(templateName).first()).toBeVisible({ timeout: 20_000 })

      const { token, tenantId } = await readApiSession(page)
      expect(token, 'Token de sesión disponible').toBeTruthy()
      expect(tenantId, 'Tenant activo disponible').toBeTruthy()

      // 2) La plantilla persistió con photoGroupBy declarado
      const templates = await getJson<TemplateDto[]>(
        request,
        `${API_BASE}/api/v1/tenants/${tenantId}/catalog/product-templates`,
        token
      )
      const template = templates.find((t) => t.name === templateName)
      expect(template, 'Plantilla creada').toBeTruthy()
      createdTemplateId = template!.id

      const hierarchy = JSON.parse(template!.hierarchyTreeJson) as { photoGroupBy?: string[] }[]
      const terminal = hierarchy.at(-1)
      expect([...(terminal?.photoGroupBy ?? [])].sort()).toEqual(['Color', 'Tipo de Caña'])

      // 3) Matriz: 2 tallas × 2 cañas × 2 colores = 8 SKUs
      const dictionary = await getJson<VariantTemplateDto[]>(
        request,
        `${API_BASE}/api/v1/tenants/${tenantId}/catalog/variant-templates`,
        token
      )
      const sizeScale = dictionary.find((a) => a.name.includes('Medias / Calcetines'))
      expect(sizeScale, 'Escala de tallas del diccionario').toBeTruthy()
      const tallas = (JSON.parse(sizeScale!.predefinedValuesJson) as string[]).slice(0, 2)
      const canas = ['Caña Alta', 'Caña Corta']
      const colores = ['#457fc9', '#ec4899']

      const dimensions = [
        { name: 'Medias / Calcetines', values: tallas, type: 'size' },
        { name: 'Tipo de Caña', values: canas, photoGroup: true, type: 'custom' },
        { name: 'Color', values: colores, photoGroup: true, type: 'color' },
      ]

      const variants = tallas.flatMap((talla) =>
        canas.flatMap((cana) =>
          colores.map((color) => ({
            variantTitle: `${talla} / ${cana} / ${color}`,
            sku: `E2E-${run}-${tallaDigits(talla)}-${canaCode[cana]}-${color.slice(1).toUpperCase()}`,
            customAttributesJson: JSON.stringify({
              'medias / calcetines': talla,
              'tipo de caña': cana,
              color,
              tags: ['e2e', 'calcetin'],
              colores_secundarios: [color === '#457fc9' ? '#eaab08' : '#ec4899'],
            }),
            initialStock: 5,
          }))
        )
      )

      const matrixResponse = await request.post(
        `${API_BASE}/api/v1/tenants/${tenantId}/catalog/items/matrix`,
        {
          headers: authHeaders(token),
          data: {
            kind: 0,
            name: itemName,
            description: 'Matriz E2E de calcetines',
            familyId: template!.id,
            variantDimensionsJson: JSON.stringify(dimensions),
            variants,
          },
        }
      )
      const matrixBody = await matrixResponse.text()
      expect(
        matrixResponse.ok(),
        `POST matrix -> ${matrixResponse.status()} ${matrixBody.slice(0, 300)}`
      ).toBeTruthy()
      const matrix = JSON.parse(matrixBody) as MatrixResponse
      createdItemId = matrix.parentItemId
      createdVariantIds = matrix.variantItemIds ?? []
      expect(matrix.createdVariantsCount).toBe(tallas.length * canas.length * colores.length)

      // 4) Foto compartida del grupo compuesto (se sube una vez al padre)
      let storageConfigured = true
      const uploadResponse = await request.post(
        `${API_BASE}/api/v1/tenants/${tenantId}/catalog/items/${matrix.parentItemId}/images`,
        {
          headers: authHeaders(token),
          multipart: {
            file: {
              name: 'cana-alta-457fc9.png',
              mimeType: 'image/png',
              buffer: PNG_400,
            },
            altText: 'Caña Alta #457fc9',
            setAsMain: true,
            groupValue: 'Caña Alta|#457fc9',
          },
        }
      )

      if (!uploadResponse.ok()) {
        const body = await uploadResponse.text()
        if (body.includes('catalog.image.storage_error')) {
          storageConfigured = false
          test.info().annotations.push({
            type: 'storage-b2-no-configurado',
            description:
              'Sin Storage__KeyId / Storage__ApplicationKey la galería no se sube; se omite la validación de herencia por grupo.',
          })
        } else {
          expect(uploadResponse.ok(), `POST image -> ${uploadResponse.status()} ${body.slice(0, 200)}`).toBeTruthy()
        }
      }

      // 5) Contrato de lectura: descriptor tipado + galería heredada + metadata
      const detail = await getJson<ItemDetail>(
        request,
        `${API_BASE}/api/v1/tenants/${tenantId}/catalog/items/${matrix.parentItemId}`,
        token
      )

      expect(detail.matrixDescriptor.depth).toBe(3)
      const axes = Object.fromEntries(detail.matrixDescriptor.axes.map((a) => [a.name, a]))
      expect(axes['Medias / Calcetines'].type).toBe('size')
      expect(axes['Medias / Calcetines'].isPhotoGroup).toBe(false)
      expect(axes['Tipo de Caña'].isPhotoGroup).toBe(true)
      expect(axes['Color'].isPhotoGroup).toBe(true)

      const targetSku = `E2E-${run}-${tallaDigits(tallas[0])}-AL-457FC9`
      const variant = detail.variants.find((v) => v.sku === targetSku)
      expect(variant, `Variante ${targetSku}`).toBeTruthy()
      expect(variant!.dimensionValues?.['Tipo de Caña']).toBe('Caña Alta')
      expect(variant!.dimensionValues?.['Color']).toBe('#457fc9')
      expect(variant!.tags ?? []).toEqual(expect.arrayContaining(['e2e', 'calcetin']))
      expect(variant!.extraColors ?? []).toContain('#eaab08')

      if (storageConfigured) {
        expect(detail.matrixDescriptor.groupValues).toContain('Caña Alta|#457fc9')
        expect(variant!.imageInheritedFrom).toBe('group')
        expect(variant!.images?.length ?? 0).toBeGreaterThan(0)
      }
    } finally {
      // Limpieza best-effort para no agotar el límite de plantillas del plan
      const { token, tenantId } = await readApiSession(page).catch(() => ({ token: '', tenantId: '' }))
      if (token && tenantId) {
        for (const variantId of createdVariantIds) {
          await request
            .delete(`${API_BASE}/api/v1/tenants/${tenantId}/catalog/items/${variantId}`, {
              headers: authHeaders(token),
            })
            .catch(() => undefined)
        }
        if (createdItemId) {
          await request
            .delete(`${API_BASE}/api/v1/tenants/${tenantId}/catalog/items/${createdItemId}`, {
              headers: authHeaders(token),
            })
            .catch(() => undefined)
        }
        if (createdTemplateId) {
          await request
            .delete(`${API_BASE}/api/v1/tenants/${tenantId}/catalog/product-templates/${createdTemplateId}`, {
              headers: authHeaders(token),
            })
            .catch(() => undefined)
        }
      }
    }
  })
})
