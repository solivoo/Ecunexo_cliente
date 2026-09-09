/**
 * Independiente: CRUD de categoría e ítem servicio. No crea físico ni toca Stock.
 */
import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Independiente — catálogo de servicios', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('pro-independiente')
    await loginAsSeedUser(page, 'pro-independiente')
  })

  test('listado de ítems carga', async ({ page }) => {
    await page.goto('/catalogo/items')
    await expect(page.getByLabel('Resumen de catálogo')).toBeVisible({ timeout: 20_000 })
  })

  test('CRUD categoría Servicios', async ({ page }) => {
    await page.goto('/catalogo/categorias')
    await expect(page.getByLabel('Resumen de categorías')).toBeVisible({ timeout: 20_000 })

    if (!(await page.getByText('Servicios', { exact: true }).first().isVisible().catch(() => false))) {
      await page.goto('/catalogo/categorias/nueva')
      await expect(page.locator('#cc-name')).toBeVisible({ timeout: 20_000 })
      await page.locator('#cc-name').fill('Servicios')
      await page.locator('#cc-desc').fill('Servicios profesionales Loma Soft')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(page).toHaveURL(/\/catalogo\/categorias/, { timeout: 20_000 })
    }

    await expect(page.getByText('Servicios').first()).toBeVisible({ timeout: 20_000 })
  })

  test('CRUD ítem servicio Visita técnica', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6)
    const name = `Visita técnica ${stamp}`
    const edited = `${name} (revisada)`

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#ci-name').fill(name)
    await page.locator('#ci-price').fill('45.00')
    await page.locator('#ci-desc').fill('Asesoría o soporte en sitio del cliente.')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    const created = page.getByRole('row', { name: new RegExp(name) })
    await expect(created).toBeVisible({ timeout: 20_000 })

    await created.getByRole('button', { name: 'Editar' }).click()
    await expect(page.locator('#ei-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#ei-name').fill(edited)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    await expect(page.getByRole('row', { name: new RegExp(edited.replace(/[()]/g, '\\$&')) })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('eliminar ítem servicio sin uso (baja lógica)', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6)
    const name = `Servicio borrable ${stamp}`

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#ci-name').fill(name)
    await page.locator('#ci-price').fill('12.50')
    await page.locator('#ci-desc').fill('Ítem temporal para probar DELETE soft.')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible({ timeout: 20_000 })

    const deleteBtn = row.getByRole('button', { name: 'Eliminar' })
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 })

    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toMatch(/Eliminar/i)
      void dialog.accept()
    })
    await deleteBtn.click()

    await expect(page.getByText(/Ítem eliminado|quedó dado de baja/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('eliminar desde editar ítem', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6)
    const name = `Servicio editar-borrar ${stamp}`

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#ci-name').fill(name)
    await page.locator('#ci-price').fill('9.99')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.getByRole('button', { name: 'Editar' }).click()

    await expect(page.locator('#ei-name')).toBeVisible({ timeout: 20_000 })
    const deleteOnEdit = page.getByRole('button', { name: 'Eliminar', exact: true })
    await expect(deleteOnEdit).toBeVisible({ timeout: 10_000 })

    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm')
      void dialog.accept()
    })
    await deleteOnEdit.click()

    await expect(page).toHaveURL(/\/catalogo\/items$/, { timeout: 20_000 })
    await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('eliminar categoría sin ítems (baja lógica)', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6)
    const name = `Cat borrable ${stamp}`

    await page.goto('/catalogo/categorias/nueva')
    await expect(page.locator('#cc-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#cc-name').fill(name)
    await page.locator('#cc-desc').fill('Categoría temporal para DELETE soft.')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/catalogo\/categorias/, { timeout: 20_000 })
    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible({ timeout: 20_000 })

    const deleteBtn = row.getByRole('button', { name: 'Eliminar' })
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 })
    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm')
      void dialog.accept()
    })
    await deleteBtn.click()

    await expect(page.getByText(/Categoría eliminada|dada de baja/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})
