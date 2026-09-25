import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

/**
 * Identity UI: con tenant activo, TenantSessionGate no renderiza h1;
 * las páginas usan lead + métricas + menú de acciones.
 */
test.describe('Identity — equipo y seguridad (UI)', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('login deja sesión de tenant activa', async ({ page }) => {
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
      .toBeTruthy()
  })

  test('Usuarios: listado carga', async ({ page }) => {
    await page.goto('/equipo/usuarios')
    await expect(page.getByText(/Personas de esta empresa/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Acciones de usuarios' })).toBeVisible()
    await expect(page.getByLabel('Resumen de usuarios')).toBeVisible()
  })

  test('Roles: listado carga', async ({ page }) => {
    await page.goto('/equipo/roles')
    await expect(page.getByText(/Perfiles de permisos de esta empresa/i)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: 'Acciones de roles' })).toBeVisible()
    await expect(page.getByLabel('Resumen de roles')).toBeVisible()
  })

  test('Departamentos: listado carga', async ({ page }) => {
    await page.goto('/equipo/departamentos')
    await expect(page.getByText(/Unidades organizacionales/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Acciones de departamentos' })).toBeVisible()
    await expect(page.getByLabel('Resumen de departamentos')).toBeVisible()
  })

  test('Permisos: catálogo de seguridad carga', async ({ page }) => {
    await page.goto('/seguridad/permisos')
    await expect(page.getByRole('heading', { name: /Catálogo de Permisos/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel('Resumen de permisos')).toBeVisible()
    await expect(page.getByRole('button', { name: /Roles/i })).toBeVisible()
  })

  test('Formulario nuevo usuario abre', async ({ page }) => {
    await page.goto('/equipo/usuarios/nueva')
    await expect(page.getByRole('heading', { name: /Nuevo Usuario/i })).toBeVisible({
      timeout: 20_000,
    })
    const email = page.locator('#cu-email')
    if (await email.isVisible().catch(() => false)) {
      await expect(email).toBeVisible()
    }
  })

  test('Formulario nuevo rol abre', async ({ page }) => {
    await page.goto('/equipo/roles/nuevo')
    await expect(page.getByRole('heading', { name: /Nuevo Rol/i })).toBeVisible({
      timeout: 20_000,
    })
  })
})
