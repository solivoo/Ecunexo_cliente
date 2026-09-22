import { expect, test } from '@playwright/test'
import { disposePlanOrg, provisionPlanOrg, type ProvisionedOrg } from '../helpers/licenseLifecycle'
import { loginAs } from '../helpers/loginAsSeedUser'
import { planByCode } from '../helpers/planMatrix'
import { selectGluOption } from '../helpers/gluSelect'
import { licenseMatrixEnabled } from '../helpers/licenseLifecycle'

const API = 'http://localhost:5088'

// Plan activo en Platform que incluye el módulo catálogo.
const plan = { ...planByCode('local-comercio')!, code: 'ent-001' as const }

const LEVELS = [
  { id: 'l1', name: 'Tipo ítem', hasColor: false, hasImages: false, attributes: ['Tipo Calcetín'], photoScope: 'none' },
  { id: 'l2', name: 'Colección ítem', hasColor: false, hasImages: false, attributes: ['Coleccion'], photoScope: 'none' },
  { id: 'l3', name: 'Categoría ítem', hasColor: false, hasImages: false, attributes: ['Categoria Calcetin'], photoScope: 'none' },
  { id: 'l4', name: 'Producto / ítem', hasColor: false, hasImages: false, attributes: ['Marca', 'Material'], photoScope: 'none' },
  { id: 'l5', name: 'Variante Dimensional 1', hasColor: false, hasImages: false, attributes: ['Tallas'], photoScope: 'none' },
  {
    id: 'l6',
    name: 'Variante dimensional 2',
    hasColor: true,
    hasImages: true,
    attributes: ['Tipo de Caña', 'Actividad / Uso', 'Tags'],
    photoScope: 'variant',
  },
]

test.describe.configure({ mode: 'serial', timeout: 240_000 })

let org: ProvisionedOrg | null = null

test.describe('Variantes multidimensionales (Talla × Caña × Color) y tags/colores múltiples', () => {
  test.skip(!licenseMatrixEnabled(), 'Requiere E2E_LICENSE_MATRIX=1 (APIs platform + tenant).')

  test.beforeAll(async () => {
    org = await provisionPlanOrg(plan)
  })

  test.afterAll(async () => {
    await disposePlanOrg(org)
    org = null
  })

  test('genera ejes de talla y caña, grupos por color, y admite tags y colores múltiples', async ({
    page,
  }) => {
    await loginAs(page, org!.ownerEmail, org!.ownerPassword)

    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('persist:ecunexo-tenant-auth')
      if (!raw) return null
      const bag = JSON.parse(raw) as Record<string, string>
      return {
        token: JSON.parse(bag.accessToken ?? 'null') as string | null,
        tenantId: JSON.parse(bag.tenantId ?? 'null') as string | null,
      }
    })

    const created = await page.request.post(
      `${API}/api/v1/tenants/${auth!.tenantId}/catalog/product-templates`,
      {
        headers: { Authorization: `Bearer ${auth!.token}` },
        data: {
          name: 'Calcetines 6 niveles',
          description: 'Plantilla de prueba para variantes multidimensionales',
          hierarchyTreeJson: JSON.stringify(LEVELS),
          isActive: true,
        },
      }
    )
    expect(created.ok()).toBeTruthy()
    const tpl = (await created.json()) as { id: string }

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-template')).toBeVisible({ timeout: 20_000 })
    await selectGluOption(page, 'ci-template', 'Calcetines 6 niveles')
    await page.waitForTimeout(800)

    // Con eje Color sin valores, el primer color abre el grupo de variantes.
    await page.getByRole('button', { name: /Añadir Color/ }).click()
    await expect(page.getByText('Nuevo Color')).toBeVisible({ timeout: 10_000 })
    const firstColorInput = page.locator('.glb-popup__panel .glb-colorpicker__input')
    await firstColorInput.fill('#ef4444')
    await page.getByRole('button', { name: /Aceptar/i }).click()

    const row = page.locator('.ecu-variant-sub-item-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Los ejes físicos de la fila deben incluir Talla, Tipo de Caña y colores adicionales
    // (el color principal lo define el grupo).
    const labels = await row.locator('.ecu-variant-sub-item-label').allInnerTexts()
    const labelsLower = labels.map((l) => l.toLowerCase())
    expect(labelsLower).toEqual(
      expect.arrayContaining(['tallas', 'tipo de caña', 'colores adicionales'])
    )

    // El grupo de color existe y el conteo refleja 1 color.
    await expect(page.locator('.ecu-matrix-bulk-bar__count')).toContainText(/1 color/)

    // Añadir una segunda talla dentro del mismo color.
    await page.getByRole('button', { name: /Añadir Tallas/ }).click()
    await expect(page.locator('.ecu-variant-sub-item-row')).toHaveCount(2)

    // Tags múltiples por variante (chips).
    const firstRow = page.locator('.ecu-variant-sub-item-row').first()
    const tagInput = firstRow.locator('.ecu-tag-input-container input')
    await tagInput.type('Running')
    await tagInput.press('Enter')
    await tagInput.type('Casual')
    await tagInput.press('Enter')
    await expect(firstRow.getByText('#Running', { exact: true })).toBeVisible()
    await expect(firstRow.getByText('#Casual', { exact: true })).toBeVisible()

    // Colores múltiples por variante (color adicional por hex).
    await firstRow.getByRole('button', { name: 'Añadir color' }).click()
    await expect(page.getByText('Color adicional de la variante')).toBeVisible({ timeout: 10_000 })
    const modalInput = page.locator('.glb-popup__panel .glb-colorpicker__input')
    await modalInput.fill('#2563eb')
    await page.getByRole('button', { name: /Aceptar/i }).click()
    await expect(firstRow.locator('.ecu-extra-color-chip').filter({ hasText: '#2563eb' })).toBeVisible()

    // Guardar la matriz con sus variantes.
    const skuInputs = page.locator('.ecu-variant-sub-item-row input[placeholder="Ej. NIK-001-0001"]')
    const count = await skuInputs.count()
    for (let i = 0; i < count; i++) {
      await skuInputs.nth(i).fill(`CALC-${i + 1}`)
    }
    await page.getByRole('button', { name: /Guardar con Variantes/i }).click()
    await expect(page).toHaveURL(/\/catalogo\/items$/, { timeout: 20_000 })

    // Verificar el editor de plantilla: la terminal queda claramente al final de la jerarquía.
    await page.goto(`/catalogo/plantillas/${tpl.id}`)
    await expect(page.getByText('Nivel 6 (Terminal / Variantes)')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Simulación de Desglose en Catálogo:')).toBeVisible()
    await expect(page.getByText(/SKUs por combinación:\s*Tallas/)).toBeVisible()
  })

  test('permite colores propios por variante sin eje Color (solo tallas)', async ({ page }) => {
    await loginAs(page, org!.ownerEmail, org!.ownerPassword)

    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('persist:ecunexo-tenant-auth')
      if (!raw) return null
      const bag = JSON.parse(raw) as Record<string, string>
      return {
        token: JSON.parse(bag.accessToken ?? 'null') as string | null,
        tenantId: JSON.parse(bag.tenantId ?? 'null') as string | null,
      }
    })

    const templateName = `Medias solo talla ${Date.now()}`
    const created = await page.request.post(
      `${API}/api/v1/tenants/${auth!.tenantId}/catalog/product-templates`,
      {
        headers: { Authorization: `Bearer ${auth!.token}` },
        data: {
          name: templateName,
          description: 'Plantilla sin eje color para colores por variante',
          hierarchyTreeJson: JSON.stringify([
            {
              id: 'l1',
              name: 'Producto / ítem',
              hasColor: false,
              hasImages: false,
              attributes: ['Marca'],
              photoScope: 'none',
            },
            {
              id: 'l2',
              name: 'Variante',
              hasColor: false,
              hasImages: false,
              attributes: ['Tallas'],
              photoScope: 'none',
            },
          ]),
          isActive: true,
        },
      }
    )
    expect(created.ok()).toBeTruthy()

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-template')).toBeVisible({ timeout: 20_000 })
    await selectGluOption(page, 'ci-template', templateName)
    await page.waitForTimeout(800)

    const row = page.locator('.ecu-variant-sub-item-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Sin eje Color hay un único grupo «General».
    await expect(page.locator('.ecu-variant-group-card')).toHaveCount(1)
    await expect(page.locator('.ecu-variant-group-card')).toContainText('General')

    // Aun sin eje Color, cada variante admite colores propios.
    await row.getByRole('button', { name: 'Añadir color' }).click()
    await expect(page.getByText('Color adicional de la variante')).toBeVisible({ timeout: 10_000 })
    // El modal abre con la paleta lista: un clic en la muestra y Aceptar.
    await expect(page.getByText('Elige un color')).toBeVisible()
    await page.getByRole('button', { name: 'Color #22c55e' }).click()
    await page.getByRole('button', { name: /Aceptar/i }).click()
    await expect(row.locator('.ecu-extra-color-chip').filter({ hasText: '#22c55e' })).toBeVisible()

    const skuInputs = page.locator('.ecu-variant-sub-item-row input[placeholder="Ej. NIK-001-0001"]')
    const count = await skuInputs.count()
    for (let i = 0; i < count; i++) {
      await skuInputs.nth(i).fill(`MED-${i + 1}`)
    }
    await page.getByRole('button', { name: /Guardar con Variantes/i }).click()
    await expect(page).toHaveURL(/\/catalogo\/items$/, { timeout: 20_000 })

    // El color quedó persistido como atributo de la variante (colores_secundarios).
    const listRes = await page.request.get(
      `${API}/api/v1/tenants/${auth!.tenantId}/catalog/items?onlyRoots=true`,
      { headers: { Authorization: `Bearer ${auth!.token}` } }
    )
    expect(listRes.ok()).toBeTruthy()
    const items = (await listRes.json()) as { id: string; name: string }[]
    const createdItem = items.find((i) => i.name.trim() === templateName)
    expect(createdItem).toBeTruthy()

    const detailRes = await page.request.get(
      `${API}/api/v1/tenants/${auth!.tenantId}/catalog/items/${createdItem!.id}`,
      { headers: { Authorization: `Bearer ${auth!.token}` } }
    )
    expect(detailRes.ok()).toBeTruthy()
    const detail = (await detailRes.json()) as {
      variants?: { sku: string | null; extraColors?: string[] | null }[]
    }
    const variant = (detail.variants ?? []).find((v) => v.sku === 'MED-1')
    expect(variant?.extraColors ?? []).toContain('#22c55e')

    // Edición: la grilla de variantes muestra los colores del SKU y permite agregar más.
    await page.goto(`/catalogo/items/${createdItem!.id}`)
    await expect(page.getByText('Variantes Registradas', { exact: false })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('#22c55e', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Colores de la variante' }).first().click()
    await expect(page.getByText('Colores de la Variante')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Color #ef4444' }).click()
    await page
      .locator('.glb-popup__panel')
      .filter({ hasText: 'Colores de la Variante' })
      .getByRole('button', { name: 'Guardar', exact: true })
      .click()
    await expect(page.getByText('Colores de la Variante')).toBeHidden({ timeout: 10_000 })

    const afterEditRes = await page.request.get(
      `${API}/api/v1/tenants/${auth!.tenantId}/catalog/items/${createdItem!.id}`,
      { headers: { Authorization: `Bearer ${auth!.token}` } }
    )
    expect(afterEditRes.ok()).toBeTruthy()
    const afterEdit = (await afterEditRes.json()) as {
      variants?: { sku: string | null; extraColors?: string[] | null }[]
    }
    const editedVariant = (afterEdit.variants ?? []).find((v) => v.sku === 'MED-1')
    expect(editedVariant?.extraColors ?? []).toEqual(
      expect.arrayContaining(['#22c55e', '#ef4444'])
    )
  })
})
