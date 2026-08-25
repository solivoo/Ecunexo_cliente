/**
 * Independiente: rol Ayudante, asignar y quitar un permiso, alta de usuario (cupo 2).
 * No toca el rol Administrador.
 */
import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

const ROLE = 'Ayudante'
const PERM = 'catalog.item.read'

test.describe('Independiente — equipo y permisos', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('pro-independiente')
    await loginAsSeedUser(page, 'pro-independiente')
  })

  test('listados de usuarios, roles y departamentos cargan', async ({ page }) => {
    await page.goto('/equipo/usuarios')
    await expect(page.getByLabel('Resumen de usuarios')).toBeVisible({ timeout: 20_000 })

    await page.goto('/equipo/roles')
    await expect(page.getByLabel('Resumen de roles')).toBeVisible({ timeout: 20_000 })

    await page.goto('/equipo/departamentos')
    await expect(page.getByLabel('Resumen de departamentos')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Administraci[oó]n/i).first()).toBeVisible()
  })

  test('CRUD rol Ayudante: asignar y quitar permiso', async ({ page }) => {
    await page.goto('/equipo/roles')
    await expect(page.getByLabel('Resumen de roles')).toBeVisible({ timeout: 20_000 })

    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/))
    if (await search.first().isVisible().catch(() => false)) {
      await search.first().fill(ROLE)
    }

    const existing = page.getByRole('row', { name: new RegExp(`^${ROLE}\\b`) })
    if (await existing.isVisible().catch(() => false)) {
      await existing.getByRole('button', { name: 'Gestionar permisos' }).click()
    } else {
      await page.goto('/equipo/roles/nuevo')
      await expect(page.locator('#cr-name')).toBeVisible({ timeout: 20_000 })
      await page.locator('#cr-name').fill(ROLE)
      await page.locator('#cr-desc').fill('Ayudante del titular — ensayo Independiente')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      const created = page.url().includes('/permisos')
      if (!created) {
        await page.goto('/equipo/roles')
        await expect(page.getByLabel('Resumen de roles')).toBeVisible({ timeout: 20_000 })
        if (await search.first().isVisible().catch(() => false)) {
          await search.first().fill(ROLE)
        }
        await page.getByRole('row', { name: new RegExp(`^${ROLE}\\b`) }).getByRole('button', { name: 'Gestionar permisos' }).click()
      }
    }

    await expect(page.getByLabel('Resumen de permisos')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(PERM).first()).toBeVisible({ timeout: 20_000 })

    const permRow = page.getByRole('row', { name: new RegExp(PERM.replace('.', '\\.')) })
    const box = permRow.getByRole('checkbox')
    await expect(box).toBeVisible({ timeout: 15_000 })

    if (!(await box.isChecked())) {
      await box.click()
    }
    const save = page.getByRole('button', { name: 'Guardar', exact: true })
    if (await save.isEnabled()) {
      await save.click()
      await expect(page.getByText('Sin cambios')).toBeVisible({ timeout: 20_000 })
    }
    await expect(box).toBeChecked()

    await box.click()
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText('Sin cambios')).toBeVisible({ timeout: 20_000 })
    await expect(box).not.toBeChecked()
  })

  test('alta de usuario ayudante si queda cupo', async ({ page }) => {
    const email = 'ayudante.loma@ecunexo.test'
    await page.goto('/equipo/usuarios')
    await expect(page.getByLabel('Resumen de usuarios')).toBeVisible({ timeout: 20_000 })

    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/))
    if (await search.first().isVisible().catch(() => false)) {
      await search.first().fill(email)
    }
    if (await page.getByText(email).first().isVisible().catch(() => false)) {
      return
    }

    await page.goto('/equipo/usuarios/nueva')
    await expect(page.locator('#cu-email')).toBeVisible({ timeout: 20_000 })
    await page.locator('#cu-email').fill(email)
    await page.locator('#cu-name').fill('Luis Ayudante')
    await page.locator('#cu-password').fill('Ayudante2026!')
    await page.locator('#cu-password-confirm').fill('Ayudante2026!')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    const conflict = page.getByRole('alert').filter({ hasText: /409|ya exist|correo/i })
    if (await conflict.isVisible().catch(() => false)) {
      await page.goto('/equipo/usuarios')
    }

    await expect(page.getByText(email).first()).toBeVisible({ timeout: 20_000 })
  })
})
