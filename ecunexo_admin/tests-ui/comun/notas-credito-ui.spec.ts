import { expect, test, type Page } from '@playwright/test'

async function setupMockSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          token: 'mock-jwt-token',
          user: {
            id: 'user-001',
            email: 'admin@empresa.com',
            name: 'Administrador Demo',
          },
          tenantId: 'tenant-demo-id',
          userId: 'user-001',
          emitterId: 'emitter-demo-id',
          permissions: [
            'facturacion.notas.credito.read',
            'facturacion.notas.credito.create',
            'facturacion.read',
            'facturacion.comprobantes.read',
          ],
        },
        version: 0,
      })
    )
  })
}

test.describe('Módulo de Notas de Crédito Electrónicas SRI (Tipo 04)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockSession(page)
  })

  test('Renderiza correctamente la vista de listado /facturacion/notas-credito con PageHeader y StatCards', async ({ page }) => {
    // Interceptar API listInvoices
    await page.route('**/api/v1/emitters/**/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              invoiceId: 'nc-001',
              issueDate: '2026-09-18',
              establishment: '001',
              emissionPoint: '001',
              sequential: '000000001',
              accessKey: '1809202604179214673900120010010000000011234567812',
              counterpartyName: 'CLIENTE PRUEBA S.A.',
              counterpartyIdentification: '1792146739001',
              grandTotal: 115.0,
              state: 'Authorized',
              sriTransmissionState: 'Authorized',
              createdAt: '2026-09-18T10:00:00Z',
              canResend: false,
              documentType: '04',
              isVoided: false,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 50,
        }),
      })
    })

    await page.goto('/facturacion/notas-credito')

    // Verificaciones visuales M3
    await expect(page.locator('h1')).toContainText('Notas de Crédito SRI')
    await expect(page.getByText('SRI 04')).toBeVisible()
    await expect(page.getByText('Total Registradas')).toBeVisible()
    await expect(page.getByText('Autorizadas SRI')).toBeVisible()
    await expect(page.getByText('Monto Modificado')).toBeVisible()
    await expect(page.getByText('CLIENTE PRUEBA S.A.')).toBeVisible()
  })

  test('Navega a la vista dedicada de creación /facturacion/notas-credito/nueva', async ({ page }) => {
    await page.route('**/api/v1/emitters/**/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 50,
        }),
      })
    })

    await page.goto('/facturacion/notas-credito/nueva')

    await expect(page.locator('h1')).toContainText('Nueva Nota de Crédito Electrónica')
    await expect(page.getByText('1. Factura de Sustento (Documento Modificado)')).toBeVisible()
    await expect(page.getByText('← Volver al listado')).toBeVisible()
  })

  test('Oculta el botón "+ Nueva Nota de Crédito" cuando el usuario sólo tiene permiso de LECTURA (sin creación)', async ({ page }) => {
    // Configurar sesión sólo con permiso de lectura (facturacion.notas.credito.read)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'mock-jwt-token',
            user: { id: 'user-read-only', email: 'viewer@empresa.com', name: 'Lector Audit' },
            tenantId: 'tenant-demo-id',
            userId: 'user-read-only',
            emitterId: 'emitter-demo-id',
            permissions: ['facturacion.notas.credito.read', 'facturacion.read'],
          },
          version: 0,
        })
      )
    })

    await page.route('**/api/v1/emitters/**/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
      })
    })

    await page.goto('/facturacion/notas-credito')

    // El listado debe renderizarse pero el botón de creación debe estar oculto
    await expect(page.locator('h1')).toContainText('Notas de Crédito SRI')
    await expect(page.getByRole('button', { name: /Nueva Nota de Crédito/i })).toHaveCount(0)
  })

  test('Muestra el botón "+ Nueva Nota de Crédito" cuando el usuario posee permiso de CREACIÓN (facturacion.notas.credito.create)', async ({ page }) => {
    // La sesión beforeEach incluye facturacion.notas.credito.create
    await page.route('**/api/v1/emitters/**/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
      })
    })

    await page.goto('/facturacion/notas-credito')

    await expect(page.locator('h1')).toContainText('Notas de Crédito SRI')
    await expect(page.getByRole('button', { name: /Nueva Nota de Crédito/i })).toBeVisible()
  })
})
