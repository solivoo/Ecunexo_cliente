import { expect, test } from '@playwright/test'

test.describe('Módulo Taller & Reparaciones B2B UI', () => {
  test('Pantalla Pública de Verificación QR: carga limpia y responsive sin login', async ({ page }) => {
    // La pantalla de verificación es pública para transportistas y guardias
    await page.goto('/verificar/despacho/demo-hash-12345')

    await expect(
      page.getByRole('heading', { name: /Acta de Despacho Certificada/i })
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.getByText(/Verificación Oficial EcuNexo Taller/i)
    ).toBeVisible()
  })

  test.describe('Vistas autenticadas de Taller B2B', () => {
    test.beforeEach(async ({ page }) => {
      // Mockear endpoints de autenticación y sesión para validar UI de forma aislada
      await page.route('**/api/v1/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-mock-token',
            expiresAt: '2030-01-01T00:00:00Z',
            userId: 'usr-e2e-1',
            tenantId: 'tnt-e2e-1',
            isSubscriptionHolder: false,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'usr-e2e-1',
              email: 'e2e@ecunexo.test',
              name: 'Operador Taller E2E',
              department: 'Taller',
              phone: '0991234567',
              jobTitle: 'Supervisor Técnico',
              roleIds: ['role-admin'],
            },
            tenant: {
              id: 'tnt-e2e-1',
              name: 'Taller Central E2E',
              timeZoneId: 'America/Guayaquil',
              locale: 'es-EC',
              logoUrl: null,
              status: 1,
              servicePlanName: 'Taller Mixto',
              maxUsers: 10,
              maxWarehouses: 5,
              subscriptionMaxTenants: 1,
              enabledModules: ['repairs', 'taller'],
            },
            permissions: [
              'repairs.batches.read',
              'repairs.batches.import',
              'repairs.batches.cancel',
              'repairs.equipments.update.status',
              'repairs.equipments.upload.photo',
              'repairs.dispatches.read',
              'repairs.dispatches.create',
              'repairs.b2b.portal.view',
            ],
            navigation: [
              {
                id: 'taller',
                label: 'Reparaciones',
                icon: 'wrench',
                children: [
                  { id: 'batches', label: 'Lotes B2B', route: '/taller/lotes', children: [] },
                  { id: 'dispatches', label: 'Despachos', route: '/taller/despachos', children: [] },
                  { id: 'portal', label: 'Portal Corporativo', route: '/taller/portal', children: [] },
                ],
              },
            ],
            settings: {},
            permVersion: '1',
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'batch-001',
              batchNumber: 'LOTE-WPH-2026-001',
              customerName: 'Whirlpool del Ecuador S.A.',
              contractReference: 'CT-WPH-2026-Q1',
              status: 1,
              receivedAt: '2026-09-01T10:00:00Z',
              totalCount: 15,
              receivedCount: 2,
              inRepairCount: 8,
              readyCount: 3,
              dispatchedCount: 2,
              progressPercentage: 33.3,
            },
            {
              id: 'batch-002',
              batchNumber: 'LOTE-WPH-2026-002',
              customerName: 'Whirlpool del Ecuador S.A.',
              contractReference: 'CT-WPH-2026-Q2',
              status: 1,
              receivedAt: '2026-09-02T10:00:00Z',
              totalCount: 5,
              receivedCount: 5,
              inRepairCount: 0,
              readyCount: 0,
              dispatchedCount: 0,
              progressPercentage: 0,
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/customers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'cust-001',
              name: 'Whirlpool del Ecuador S.A.',
              taxId: '1790012345001',
              contactEmail: 'servicio@whirlpool.ec',
              active: true,
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/dispatches', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-001', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-001',
            batchNumber: 'LOTE-WPH-2026-001',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            contractReference: 'CT-WPH-2026-Q1',
            status: 1,
            receivedAt: '2026-09-01T10:00:00Z',
            totalCount: 15,
            receivedCount: 2,
            inRepairCount: 8,
            readyCount: 3,
            dispatchedCount: 2,
            rateN1: 45.0,
            rateN2: 85.0,
            rateN3: 150.0,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-001/equipments', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'eq-001',
              batchId: 'batch-001',
              serialNumber: 'WP-SN-998811',
              model: 'LAVADORA XPERT 19KG',
              brand: 'Whirlpool',
              damageLevel: 1,
              status: 1,
              photosCount: 2,
              notes: 'Filtro obstruido',
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-002', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-002',
            batchNumber: 'LOTE-WPH-2026-002',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            contractReference: 'CT-WPH-2026-Q2',
            status: 1,
            receivedAt: '2026-09-02T10:00:00Z',
            totalCount: 5,
            receivedCount: 5,
            inRepairCount: 0,
            readyCount: 0,
            dispatchedCount: 0,
            rateN1: 45.0,
            rateN2: 85.0,
            rateN3: 150.0,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-002/equipments', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'eq-002',
              batchId: 'batch-002',
              serialNumber: 'WP-SN-002233',
              model: 'SECADORA GAS 20KG',
              brand: 'Whirlpool',
              damageLevel: 2,
              status: 1,
              photosCount: 0,
              notes: 'Sin procesar',
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/preview', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalRows: 3,
            level1Count: 1,
            level2Count: 2,
            level3Count: 0,
            isValid: true,
            errors: [],
            warnings: ['Alerta de prueba: verificación preliminar correcta.'],
            items: [
              {
                rowNumber: 2,
                serialNumber: 'TEST-PREVIEW-001',
                brand: 'Whirlpool',
                model: 'LAVADORA CARGA FRONTAL',
                damageLevel: 1,
                damageLevelName: 'Nivel 1 (Leve)',
                color: 'Gris',
                detectedFault: 'Desgaste estético',
                technicalNotes: 'Fase de revisión',
              },
            ],
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-002/cancel', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-002',
            batchNumber: 'LOTE-WPH-2026-002',
            status: 5,
            cancelledReason: 'Error de digitación en contrato',
            cancelledAt: '2026-09-10T12:00:00Z',
            cancelledBy: 'usr-e2e-1',
            affectedEquipmentsCount: 5,
          }),
        })
      })

      await page.goto('/')
      await page.locator('#login-email').fill('e2e@ecunexo.test')
      await page.locator('#login-password').fill('TestPassword123!')
      await page.getByRole('button', { name: 'Iniciar sesión' }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
      await expect
        .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
        .toBeTruthy()
    })

    test('Lotes: carga PageHeader, métricas KPI y contenedor de datos', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      // PageHeader
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Acciones del header
      await expect(page.getByRole('button', { name: /Plantilla Excel/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Importar Lote/i })).toBeVisible()

      // Tira de StatCards
      const statCards = page.locator('.ecu-stat-card')
      expect(await statCards.count()).toBeGreaterThanOrEqual(3)

      // Tabla DataGrid con lote mockeado
      await expect(page.getByText('LOTE-WPH-2026-001')).toBeVisible()
    })

    test('Nuevo Lote: carga asistente, tarifario N1/N2/N3 y zona de carga Excel', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Clic en Importar Lote
      await page.getByRole('button', { name: /Importar Lote/i }).click()

      await expect(
        page.getByRole('heading', { name: /Importar Lote de Reparación/i })
      ).toBeVisible({ timeout: 20_000 })

      // Secciones
      await expect(page.getByText(/Datos del Contrato y Cliente/i)).toBeVisible()
      await expect(page.getByText(/Tarifario Acordado de Servicio/i)).toBeVisible()
      await expect(page.getByText(/Planilla de Equipos \(Excel\)/i)).toBeVisible()

      // Tarifas N1, N2, N3
      await expect(page.getByText(/Nivel 1 \(Leve \/ Estético\)/i)).toBeVisible()
      await expect(page.getByText(/Nivel 2 \(Medio \/ Chapa\)/i)).toBeVisible()
      await expect(page.getByText(/Nivel 3 \(Grave \/ Estructural\)/i)).toBeVisible()

      // Verificar que los campos iniciales estén limpios (sin datos sucios quemados)
      await expect(page.locator('#repair-batch-num')).toHaveValue('')
      await expect(page.locator('#repair-rate-n1')).toHaveValue('')

      // El input nativo de tipo file debe estar oculto con display: none
      const fileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]')
      await expect(fileInput).toBeAttached()
      await expect(fileInput).not.toBeVisible()

      // Botón de descargar plantilla
      await expect(
        page.getByRole('button', { name: /Descargar Plantilla Oficial/i })
      ).toBeVisible()

      // Botón de nuevo cliente corporativo abre el popup modal
      const newCustBtn = page.getByRole('button', { name: /Nuevo Cliente Corporativo/i })
      await expect(newCustBtn).toBeVisible()
      await newCustBtn.click()

      await expect(
        page.getByRole('heading', { name: /Registrar Cliente Corporativo/i })
      ).toBeVisible()
      await expect(page.locator('#new-cust-name')).toBeVisible()
      await expect(page.locator('#new-cust-name')).toHaveValue('')

      // Cerrar modal
      await page.getByLabel(/Registrar Cliente Corporativo/i).getByRole('button', { name: /Cancelar/i }).click()
      await expect(
        page.getByRole('heading', { name: /Registrar Cliente Corporativo/i })
      ).not.toBeVisible()
    })

    test('Actas y Despachos: carga historial y métricas de salida', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Despachos/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      await expect(
        page.getByRole('heading', { name: /Actas y Despachos de Salida/i })
      ).toBeVisible({ timeout: 20_000 })

      await expect(page.getByRole('button', { name: /Emitir Despacho/i })).toBeVisible()
    })

    test('Portal Corporativo B2B: carga branding ejecutivo y buscador de serie', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Portal Corporativo/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      // Branding corporativo y PageHeader M3
      await expect(
        page.getByRole('heading', { name: /Portal Corporativo B2B/i })
      ).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(/Auditoría B2B Certificada/i)).toBeVisible()

      // Buscador instantáneo por serie
      await expect(
        page.getByText(/Rastreo Instantáneo por Número de Serie/i)
      ).toBeVisible()
    })

    test('Detalle de Lote: abre modal Popup de cambio de fase técnica y evidencia', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Clic en el lote
      await page.getByRole('button', { name: 'LOTE-WPH-2026-001' }).click()

      // Header del lote
      await expect(
        page.getByRole('heading', { name: /Lote LOTE-WPH-2026-001/i })
      ).toBeVisible({ timeout: 20_000 })

      // Equipo en la tabla
      await expect(page.getByText('WP-SN-998811')).toBeVisible()

      // Abrir modal Popup de cambio de estado
      const changeStatusBtn = page.getByRole('button', { name: /Cambiar estado \/ Fase técnica/i })
      await expect(changeStatusBtn).toBeVisible()
      await changeStatusBtn.click()

      // Verificar que el Popup de glubox abrió
      await expect(
        page.getByRole('heading', { name: /Fase Técnica — Serie WP-SN-998811/i })
      ).toBeVisible()

      // Cerrar modal
      await page.getByRole('button', { name: /Cancelar/i }).click()

      // Abrir modal Popup de fotos en S3
      const photosBtn = page.getByRole('button', { name: /Fotos de evidencia S3/i })
      await expect(photosBtn).toBeVisible()
      await photosBtn.click()

      // Verificar que el Popup de evidencia fotográfica abrió
      await expect(page.getByRole('heading', { name: /Evidencia Fotográfica/i })).toBeVisible()
    })

    test('Previsualización de Lote: valida archivo Excel antes de permitir el guardado', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await page.getByRole('button', { name: /Importar Lote/i }).click()

      await expect(
        page.getByRole('heading', { name: /Importar Lote de Reparación/i })
      ).toBeVisible({ timeout: 20_000 })

      // El botón de importar debe estar deshabilitado inicialmente (sin archivo ni datos)
      const submitBtn = page.getByRole('button', { name: /^Importar Lote$/i })
      await expect(submitBtn).toBeDisabled()

      // Simular selección de archivo Excel
      const fileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]')
      await fileInput.setInputFiles({
        name: 'test_lote.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock excel content'),
      })

      // Se debe mostrar la previsualización y el resumen de equipos
      await expect(page.getByRole('heading', { name: /Previsualización del Lote/i })).toBeVisible()
      await expect(page.getByText('TEST-PREVIEW-001')).toBeVisible()
      await expect(page.getByText('LAVADORA CARGA FRONTAL')).toBeVisible()
      await expect(page.getByText(/Alerta de prueba: verificación preliminar correcta/i)).toBeVisible()

      // Llenar campos requeridos
      await page.locator('#repair-batch-num').fill('LOTE-WPH-TEST-PREVIEW')
      await page.locator('#repair-customer').click()
      await page.getByRole('option', { name: /Whirlpool/i }).click()

      // Con previsualización válida y campos completos, el botón de importar se transforma y se habilita
      const confirmBtn = page.getByRole('button', { name: /Confirmar e Importar Lote/i })
      await expect(confirmBtn).toBeEnabled()
    })

    test('Anulación de Lote: anula lote no intervenido con motivo obligatorio y preservación de auditoría', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()

      // En la tabla, hacer clic en el lote sin procesar LOTE-WPH-2026-002
      await page.getByRole('button', { name: 'LOTE-WPH-2026-002' }).click()

      await expect(
        page.getByRole('heading', { name: /Lote LOTE-WPH-2026-002/i })
      ).toBeVisible({ timeout: 20_000 })

      // Como no tiene equipos intervenidos y el usuario tiene el permiso repairs.batches.cancel, el botón "Anular Lote" debe ser visible
      const cancelBatchBtn = page.getByRole('button', { name: /Anular Lote/i }).first()
      await expect(cancelBatchBtn).toBeVisible()
      await cancelBatchBtn.click()

      // Modal Popup de anulación
      await expect(
        page.getByRole('heading', { name: /Anular Lote de Reparación/i })
      ).toBeVisible()

      // El botón confirmar debe estar presente
      const confirmCancelBtn = page.getByRole('button', { name: /Confirmar Anulación/i })
      await expect(confirmCancelBtn).toBeVisible()

      // Llenar motivo de anulación
      const reasonInput = page.locator('#cancel-batch-reason')
      await reasonInput.fill('Error de digitación en contrato')

      // Mockear la respuesta actualizada del lote como Anulado (status: 5) al recargar
      await page.route('**/api/v1/tenants/*/repairs/batches/batch-002', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-002',
            batchNumber: 'LOTE-WPH-2026-002',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            contractReference: 'CT-WPH-2026-Q2',
            status: 5,
            receivedAt: '2026-09-02T10:00:00Z',
            totalCount: 5,
            receivedCount: 0,
            inRepairCount: 0,
            readyCount: 0,
            dispatchedCount: 0,
            rateN1: 45.0,
            rateN2: 85.0,
            rateN3: 150.0,
            cancelledReason: 'Error de digitación en contrato',
          }),
        })
      })

      await confirmCancelBtn.click()

      // El banner de aviso de auditoría de lote anulado debe estar visible
      await expect(page.getByRole('heading', { name: /Lote Anulado para Auditoría/i })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Error de digitación en contrato')).toBeVisible()
    })
  })
})
