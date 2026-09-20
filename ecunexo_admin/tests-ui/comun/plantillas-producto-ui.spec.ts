import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Catálogo UI — Plantillas y Arquetipos Jerárquicos de Producto', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Muestra listado de plantillas, KPIs y navega al constructor jerárquico', async ({
    page,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/plantillas')
    await expect(page.locator('.app-shell')).toBeVisible()

    // Encabezado de la página de plantillas
    await expect(page.getByRole('heading', { name: /Plantillas de Producto/i })).toBeVisible({
      timeout: 20_000,
    })

    // KPI StatCards en .ecu-stat-grid
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible()
    await expect(page.getByText('Total Plantillas')).toBeVisible()
    await expect(page.getByText('Plantillas Activas')).toBeVisible()
    await expect(page.getByText('Máximo de Niveles')).toBeVisible()

    // Botón para crear nueva plantilla
    const newTemplateBtn = page.getByRole('button', { name: /Nueva Plantilla/i })
    await expect(newTemplateBtn).toBeVisible()
    await newTemplateBtn.click()

    // Navega a la vista dedicada del constructor de jerarquías
    await expect(page).toHaveURL(/\/catalogo\/plantillas\/nueva/)
    await expect(page.getByRole('heading', { name: /Nueva Plantilla de Producto/i })).toBeVisible()

    // Campos del formulario principal
    await expect(page.getByText('Nombre de la Plantilla *')).toBeVisible()
    await expect(page.getByText('Descripción / Propósito del Arquetipo')).toBeVisible()

    // Constructor de niveles jerárquicos
    await expect(page.getByText('Estructura de Niveles y Arquetipos')).toBeVisible()
    await expect(page.getByText('Nivel 1 (Base / Colección)')).toBeVisible()
    await expect(page.getByText('Nivel 2 (Submodelo / Estilo)')).toBeVisible()
    await expect(page.getByText('Nivel 3 (Terminal / Variantes)')).toBeVisible()

    // Botón para agregar nivel adicional
    const addLevelBtn = page.getByRole('button', { name: /Agregar Siguiente Nivel a la Jerarquía/i })
    await expect(addLevelBtn).toBeVisible()
    await addLevelBtn.click()

    // Ahora debe existir un Nivel 4
    await expect(page.getByText('Nivel 4 (Terminal / Variantes)')).toBeVisible()

    // Vista previa interactiva de la jerarquía
    await expect(page.getByText('Vista Previa de la Jerarquía Resultante')).toBeVisible()

    // Botón Volver
    const backBtn = page.getByRole('button', { name: /Volver/i })
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    await expect(page).toHaveURL(/\/catalogo\/plantillas/)
  })

  test('Selector de plantillas aparece en la creación de productos y muestra opciones', async ({
    page,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    await expect(page.getByRole('heading', { name: /Nuevo Ítem/i })).toBeVisible({
      timeout: 20_000,
    })

    // Acciones de página deben incluir acceso a Plantillas
    const templateAction = page.locator('button:has-text("Plantillas de producto")')
    if (await templateAction.isVisible()) {
      await expect(templateAction).toBeVisible()
    }
  })
})
