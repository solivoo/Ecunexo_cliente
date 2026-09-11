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
              enabledModules: ['customers', 'repairs', 'taller'],
            },
            permissions: [
              'customers.read',
              'customers.manage',
              'repairs.batches.read',
              'repairs.batches.import',
              'repairs.batches.cancel',
              'repairs.equipments.update.status',
              'repairs.equipments.upload.photo',
              'repairs.dispatches.read',
              'repairs.dispatches.create',
              'repairs.invoices.generate',
              'repairs.b2b.portal.view',
            ],
            navigation: [
              {
                id: 'customers',
                label: 'Clientes',
                icon: 'users',
                children: [
                  { id: 'customers-directory', label: 'Directorio de Clientes', route: '/clientes', children: [] },
                  { id: 'customers-types', label: 'Tipos de cliente', route: '/clientes/tipos', children: [] },
                ],
              },
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
            {
              id: 'batch-003',
              batchNumber: 'LOTE-WPH-2026-ANULADO',
              customerName: 'Whirlpool del Ecuador S.A.',
              contractReference: 'CT-WPH-2026-Q3',
              status: 5, // Cancelled
              receivedAt: '2026-09-03T10:00:00Z',
              totalCount: 2,
              receivedCount: 0,
              inRepairCount: 0,
              readyCount: 0,
              dispatchedCount: 0,
              progressPercentage: 0,
            },
          ]),
        })
      })

      const mockCustomers = [
        {
          id: 'cust-001',
          name: 'Whirlpool del Ecuador S.A.',
          taxId: '1790012345001',
          customerType: 1,
          identificationType: 1,
          contactEmail: 'servicio@whirlpool.ec',
          contactPhone: '042999888',
          contactPerson: 'Ing. Carlos Mendoza',
          address: 'Av. Juan Tanca Marengo Km 4.5',
          notes: 'Contrato corporativo oficial',
          isActive: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ]

      const mockCustomerTypes = [
        {
          id: 'ctype-1',
          code: 1,
          name: 'Corporativo B2B / Fabricante',
          shortLabel: 'Corporativo B2B',
          tone: 'primary',
          sortOrder: 1,
          isSystem: true,
          isActive: true,
        },
        {
          id: 'ctype-2',
          code: 2,
          name: 'Persona Natural / Particular',
          shortLabel: 'Persona Natural',
          tone: 'success',
          sortOrder: 2,
          isSystem: true,
          isActive: true,
        },
        {
          id: 'ctype-3',
          code: 3,
          name: 'Distribuidor / Mayorista',
          shortLabel: 'Distribuidor',
          tone: 'warning',
          sortOrder: 3,
          isSystem: true,
          isActive: true,
        },
        {
          id: 'ctype-4',
          code: 4,
          name: 'Taller Técnico Aliado',
          shortLabel: 'Taller Aliado',
          tone: 'neutral',
          sortOrder: 4,
          isSystem: true,
          isActive: true,
        },
        {
          id: 'ctype-5',
          code: 5,
          name: 'Consumidor Final',
          shortLabel: 'Consumidor Final',
          tone: 'neutral',
          sortOrder: 5,
          isSystem: true,
          isActive: true,
        },
        {
          id: 'ctype-6',
          code: 6,
          name: 'Institución Pública / Gobierno',
          shortLabel: 'Sector Público',
          tone: 'warning',
          sortOrder: 6,
          isSystem: true,
          isActive: true,
        },
      ]

      await page.route(/\/api\/v1\/tenants\/[^/]+\/customers\/types(\/[^/?]+)?(\?.*)?$/, async (route) => {
        const url = route.request().url()
        const method = route.request().method()

        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCustomerTypes),
          })
          return
        }

        if (method === 'POST') {
          const body = route.request().postDataJSON()
          const created = {
            id: `ctype-${Date.now()}`,
            code: 100 + mockCustomerTypes.filter((t) => !t.isSystem).length,
            name: body.name,
            shortLabel: body.shortLabel || body.name,
            tone: body.tone || 'primary',
            sortOrder: body.sortOrder ?? 100,
            isSystem: false,
            isActive: true,
          }
          mockCustomerTypes.push(created)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(created),
          })
          return
        }

        if (method === 'PUT') {
          const body = route.request().postDataJSON()
          const type = mockCustomerTypes.find((t) => url.includes(t.id))
          if (type) {
            Object.assign(type, {
              name: body.name ?? type.name,
              shortLabel: body.shortLabel ?? type.shortLabel,
              tone: body.tone ?? type.tone,
              sortOrder: body.sortOrder ?? type.sortOrder,
              isActive: body.isActive ?? type.isActive,
            })
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(type || {}),
          })
          return
        }

        if (method === 'DELETE') {
          const idx = mockCustomerTypes.findIndex((t) => url.includes(t.id) && !t.isSystem)
          if (idx >= 0) mockCustomerTypes.splice(idx, 1)
          await route.fulfill({ status: 204, body: '' })
          return
        }

        await route.fulfill({ status: 405, body: '' })
      })

      await page.route(/\/api\/v1\/tenants\/[^/]+\/(repairs\/)?customers\/(?!types)[^/?]+/, async (route) => {
        const url = route.request().url()
        if (url.includes('/status') && route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON()
          const cust = mockCustomers.find((c) => url.includes(c.id))
          if (cust) {
            cust.isActive = body.isActive
            cust.active = body.isActive
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(cust || {}),
          })
          return
        }

        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON()
          const cust = mockCustomers.find((c) => url.includes(c.id))
          if (cust) {
            Object.assign(cust, body)
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(cust || {}),
          })
          return
        }

        await route.continue()
      })

      await page.route(/\/api\/v1\/tenants\/[^/]+\/(repairs\/)?customers(\?.*)?$/, async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON()
          const created = {
            id: `cust-${Date.now()}`,
            name: body.name,
            taxId: body.taxId || null,
            customerType: body.customerType ?? 1,
            identificationType: body.identificationType ?? 1,
            contactPerson: body.contactPerson || null,
            contactEmail: body.contactEmail || null,
            contactPhone: body.contactPhone || null,
            address: body.address || null,
            notes: body.notes || null,
            isActive: true,
            active: true,
            createdAt: new Date().toISOString(),
          }
          mockCustomers.push(created)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(created),
          })
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCustomers),
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

      // Tabla DataGrid con lote mockeado activo
      await expect(page.getByText('LOTE-WPH-2026-001')).toBeVisible()

      // Por defecto no debe mostrar lotes anulados
      await expect(page.getByText('LOTE-WPH-2026-ANULADO')).not.toBeVisible()

      // Selector de filtro de lotes con glubox Select
      const filterSelect = page.locator('#filter-batches-status')
      await expect(filterSelect).toBeVisible()
      await filterSelect.click()
      await page.getByRole('option', { name: /Solo Anulados/i }).click()

      // Ahora debe mostrar el lote anulado y ocultar los activos
      await expect(page.getByText('LOTE-WPH-2026-ANULADO')).toBeVisible()
      await expect(page.getByText('LOTE-WPH-2026-001')).not.toBeVisible()

      // Restaurar a Lotes Activos
      await filterSelect.click()
      await page.getByRole('option', { name: /Lotes Activos/i }).click()
      await expect(page.getByText('LOTE-WPH-2026-001')).toBeVisible()
      await expect(page.getByText('LOTE-WPH-2026-ANULADO')).not.toBeVisible()
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
      await expect(page.getByText(/Planilla de Equipos \(Excel\)/i)).toBeVisible()
      await expect(
        page.getByText(/Las tarifas N1\/N2\/N3 se toman del tarifario del cliente/i)
      ).toBeVisible()

      // Verificar que los campos iniciales estén limpios (sin datos sucios quemados)
      await expect(page.locator('#repair-batch-num')).toHaveValue('')
      await expect(page.locator('#repair-rate-n1')).toHaveCount(0)

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

    test('Actas y Despachos: lista y vista de nueva acta parcial', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Despachos/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      await expect(
        page.getByRole('heading', { name: /Actas y Despachos/i })
      ).toBeVisible({ timeout: 20_000 })

      await expect(page.getByRole('button', { name: /Nueva Acta/i }).first()).toBeVisible()
      await page.getByRole('button', { name: /Nueva Acta/i }).first().click()

      await expect(
        page.getByRole('heading', { name: /Generar Acta de Despacho/i })
      ).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(/Datos del transportista/i)).toBeVisible()
      await expect(page.getByText(/Equipos listos para despacho/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /Emitir acta/i })).toBeVisible()
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
      await expect(page.locator('#search-serial-input')).toBeVisible()
      await page.locator('#search-serial-input').fill('SN-NO-EXISTE')
      await expect(page.getByText(/Sin coincidencias para esta serie/i)).toBeVisible({
        timeout: 10_000,
      })
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
      await expect(page.getByRole('heading', { name: /Evidencia Fotográfica en S3/i })).toBeVisible()
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

    test('Previsualización de Lote: despliega modal Popup detallando errores cuando el archivo Excel es inválido', async ({ page }) => {
      // Mock de previsualización con errores de estructura/filas
      await page.route('**/api/v1/tenants/*/repairs/batches/preview', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalRows: 0,
            level1Count: 0,
            level2Count: 0,
            level3Count: 0,
            isValid: false,
            errors: [
              'Fila 4: El número de serie es obligatorio.',
              'Fila 8: Nivel de daño inválido (debe ser 1, 2 o 3).',
            ],
            warnings: [],
            items: [],
          }),
        })
      })

      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await page.getByRole('button', { name: /Importar Lote/i }).click()

      await expect(
        page.getByRole('heading', { name: /Importar Lote de Reparación/i })
      ).toBeVisible({ timeout: 20_000 })

      // Simular selección de archivo con errores
      const fileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]')
      await fileInput.setInputFiles({
        name: 'plantilla_con_errores.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('corrupt content'),
      })

      // El modal Popup debe abrirse automáticamente detallando las inconsistencias
      await expect(
        page.getByRole('heading', { name: /Inconsistencias en la Plantilla Excel/i })
      ).toBeVisible()
      await expect(page.getByText('Fila 4: El número de serie es obligatorio.')).toBeVisible()
      await expect(page.getByText('Fila 8: Nivel de daño inválido (debe ser 1, 2 o 3).')).toBeVisible()

      // Cerrar el modal mediante el botón primario
      await page.getByRole('button', { name: /Cerrar y Corregir/i }).click()
      await expect(
        page.getByRole('heading', { name: /Inconsistencias en la Plantilla Excel/i })
      ).not.toBeVisible()

      // En la cabecera del grid se muestra el botón de alerta para reabrir el detalle
      const errorDetailBtn = page.getByRole('button', { name: /2 Errores — Ver Detalle/i })
      await expect(errorDetailBtn).toBeVisible()
      await errorDetailBtn.click()

      // Vuelve a abrir el modal
      await expect(
        page.getByRole('heading', { name: /Inconsistencias en la Plantilla Excel/i })
      ).toBeVisible()
    })

    test('Previsualización de Lote: permite desmarcar equipos mediante checkbox para excluirlos', async ({ page }) => {
      await page.route('**/api/v1/tenants/*/repairs/batches/preview', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalRows: 2,
            level1Count: 1,
            level2Count: 1,
            level3Count: 0,
            isValid: true,
            errors: [],
            warnings: [],
            items: [
              {
                rowNumber: 2,
                serialNumber: 'TEST-CHECK-001',
                brand: 'Whirlpool',
                model: 'LAVADORA MODEL A',
                damageLevel: 1,
                damageLevelName: 'Nivel 1 (Leve)',
              },
              {
                rowNumber: 3,
                serialNumber: 'TEST-CHECK-002',
                brand: 'Whirlpool',
                model: 'SECADORA MODEL B',
                damageLevel: 2,
                damageLevelName: 'Nivel 2 (Medio)',
              },
            ],
          }),
        })
      })

      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await page.getByRole('button', { name: /Importar Lote/i }).click()

      // Cargar archivo
      const fileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]')
      await fileInput.setInputFiles({
        name: 'test_selection.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock content'),
      })

      // Llenar datos requeridos
      await page.locator('#repair-batch-num').fill('LOTE-CHECK-TEST')
      await page.locator('#repair-customer').click()
      await page.getByRole('option', { name: /Whirlpool/i }).click()

      // Verificar que ambos ítems aparecen en la tabla
      await expect(page.getByText('TEST-CHECK-001')).toBeVisible()
      await expect(page.getByText('TEST-CHECK-002')).toBeVisible()

      // Inicialmente ambos están seleccionados (2 Equipos)
      const confirmBtn = page.getByRole('button', { name: /Confirmar e Importar Lote \(2 Equipos\)/i })
      await expect(confirmBtn).toBeEnabled()

      // Deseleccionar una fila mediante su checkbox en la grilla
      const rowCheckboxes = page.locator('.ecu-repairs-grid input[type="checkbox"]')
      // El primer checkbox en thead es select all, los siguientes son las filas
      const secondItemCheckbox = rowCheckboxes.nth(2)
      await secondItemCheckbox.click()

      // Al desmarcar uno, el botón se actualiza indicando (1 de 2 Equipos)
      await expect(
        page.getByRole('button', { name: /Confirmar e Importar Lote \(1 de 2 Equipos\)/i })
      ).toBeVisible()
      await expect(page.getByText(/1 de 2 seleccionados/i)).toBeVisible()
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

    test('Directorio de Clientes: listado, validaciones en tiempo real de RUC/Cédula y registro corporativo', async ({ page }) => {
      await page.getByRole('button', { name: /^Clientes$/i }).click()
      await page.getByRole('button', { name: /Directorio de Clientes/i }).click()

      // Validar PageHeader y métricas KPI
      await expect(page.getByRole('heading', { name: /Directorio de Clientes/i })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Total Clientes/i)).toBeVisible()
      await expect(page.getByText(/Clientes Activos/i)).toBeVisible()

      const emptyFiltered = page.getByRole('heading', {
        name: /No se encontraron clientes con los filtros seleccionados/i,
      })
      if (await emptyFiltered.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /Ver Todos los Clientes/i }).click()
      }

      // Verificar que el cliente inicial esté en la tabla
      await expect(page.getByText('Whirlpool del Ecuador S.A.').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('1790012345001').first()).toBeVisible()
      await expect(page.getByText('Corporativo B2B').first()).toBeVisible()

      // Abrir modal de nuevo cliente (requiere customers.manage)
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click()
      await expect(page.getByRole('heading', { name: /Registrar Nuevo Cliente/i })).toBeVisible()

      // El botón de registrar debe estar deshabilitado mientras no haya nombre
      const saveBtn = page.getByRole('button', { name: /Registrar Cliente/i })
      await expect(saveBtn).toBeDisabled()

      // Ingresar identificación inválida
      await page.locator('#customer-tax-id').fill('12345')
      await expect(page.getByText(/La identificación debe ser Cédula/i)).toBeVisible()

      // Ingresar RUC válido de sociedad privada ecuatoriana (1790010937001)
      await page.locator('#customer-tax-id').fill('1790010937001')
      await expect(page.getByText(/RUC Sociedad Privada \(Válido\)/i)).toBeVisible()

      // Ingresar correo inválido
      await page.locator('#customer-email').fill('email-invalido')
      await expect(page.getByText(/Formato de correo electrónico inválido/i)).toBeVisible()

      // Corregir correo
      await page.locator('#customer-email').fill('garantias@mabe.com.ec')

      // Ingresar teléfono y nombre
      await page.locator('#customer-phone').fill('0998765432')
      await page.locator('#customer-name').fill('Mabe del Ecuador S.A.')
      await page.locator('#customer-person').fill('Ing. Sofia Delgado')

      // Ahora el botón debe estar habilitado
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      // Modal se cierra y el nuevo cliente aparece en la tabla
      await expect(page.getByText('Mabe del Ecuador S.A.').first()).toBeVisible({ timeout: 10_000 })
    })

    test('Flujo E2E Completo: Ingreso de lote -> Control de estados -> Despacho parcial con PDF -> Facturación SRI', async ({ page }) => {
      let batchEquipmentStatus = 1 // 1: Recibido, 4: Listo para retiro, 5: Despachado
      const mockE2eEquipments = [
        {
          id: 'eq-e2e-01',
          batchId: 'batch-e2e-100',
          serialNumber: 'WP-E2E-001',
          model: 'LAVADORA XPERT 19KG',
          brand: 'Whirlpool',
          damageLevel: 1,
          status: 1,
          photosCount: 1,
          notes: 'Ingreso inicial para reacondicionamiento',
        },
        {
          id: 'eq-e2e-02',
          batchId: 'batch-e2e-100',
          serialNumber: 'WP-E2E-002',
          model: 'SECADORA GAS 20KG',
          brand: 'Whirlpool',
          damageLevel: 2,
          status: 1,
          photosCount: 0,
          notes: 'En espera de revisión',
        },
      ]

      // 1. Mock de importación de lote y listado de lotes
      await page.route(/\/api\/v1\/tenants\/[^/]+\/repairs\/batches(\?.*)?$/, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'batch-e2e-100',
                batchNumber: 'LOTE-E2E-2026-001',
                customerName: 'Whirlpool del Ecuador S.A.',
                contractReference: 'CT-WPH-E2E-2026',
                status: 1,
                receivedAt: '2026-09-10T10:00:00Z',
                totalCount: 2,
                receivedCount: batchEquipmentStatus === 1 ? 2 : 1,
                inRepairCount: 0,
                readyCount: batchEquipmentStatus === 4 ? 1 : 0,
                dispatchedCount: batchEquipmentStatus === 5 ? 1 : 0,
                progressPercentage: batchEquipmentStatus === 4 ? 50 : 0,
              },
            ]),
          })
          return
        }
        await route.continue()
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            batchId: 'batch-e2e-100',
            batchNumber: 'LOTE-E2E-2026-001',
            totalImported: 2,
            level1Count: 1,
            level2Count: 1,
            level3Count: 0,
            warnings: [],
          }),
        })
      })

      // 2. Mock de detalle de lote e inventario de equipos del lote
      await page.route('**/api/v1/tenants/*/repairs/batches/batch-e2e-100', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-e2e-100',
            batchNumber: 'LOTE-E2E-2026-001',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            contractReference: 'CT-WPH-E2E-2026',
            status: 1,
            receivedAt: '2026-09-10T10:00:00Z',
            totalCount: 2,
            receivedCount: batchEquipmentStatus === 1 ? 2 : 1,
            inRepairCount: 0,
            readyCount: batchEquipmentStatus === 4 ? 1 : 0,
            dispatchedCount: batchEquipmentStatus === 5 ? 1 : 0,
            rateN1: 45.0,
            rateN2: 85.0,
            rateN3: 150.0,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-e2e-100/equipments*', async (route) => {
        const url = route.request().url()
        if (url.includes('status=4')) {
          const ready = mockE2eEquipments.filter((e) => e.status === 4)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(ready),
          })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockE2eEquipments),
        })
      })

      // 3. Mock de actualización de fase técnica (control de estado del equipo)
      await page.route('**/api/v1/tenants/*/repairs/equipments/eq-e2e-01/status', async (route) => {
        batchEquipmentStatus = 4 // Pasa a Listo para Despacho
        mockE2eEquipments[0].status = 4
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            equipmentId: 'eq-e2e-01',
            previousStatus: 1,
            newStatus: 4,
            eventId: 'evt-001',
            occurredAt: new Date().toISOString(),
          }),
        })
      })

      // 4. Mock de Despachos (Creación, Detalle y Previsualización de Factura)
      await page.route('**/api/v1/tenants/*/repairs/dispatches', async (route) => {
        if (route.request().method() === 'POST') {
          batchEquipmentStatus = 5
          mockE2eEquipments[0].status = 5
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              dispatchId: 'dsp-e2e-001',
              dispatchNumber: 'DSP-2026-E2E-001',
              dispatchedCount: 1,
              verificationHash: 'hash-e2e-cert-9988',
            }),
          })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/dispatches/dsp-e2e-001', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'dsp-e2e-001',
            tenantId: 'tnt-e2e-1',
            batchId: 'batch-e2e-100',
            dispatchNumber: 'DSP-2026-E2E-001',
            status: 1, // Confirmed
            carrierName: 'Carlos Guamán',
            carrierDocument: '0923456789',
            carrierVehiclePlate: 'GBA-4589',
            verificationHash: 'hash-e2e-cert-9988',
            qrCodeUrl: null,
            notes: 'Despacho parcial de prueba E2E',
            invoiceId: null,
            dispatchedAt: '2026-09-10T11:00:00Z',
            items: [
              {
                id: 'item-01',
                dispatchId: 'dsp-e2e-001',
                equipmentId: 'eq-e2e-01',
                equipment: mockE2eEquipments[0],
              },
            ],
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/dispatches/dsp-e2e-001/invoice-preview', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            dispatchId: 'dsp-e2e-001',
            dispatchNumber: 'DSP-2026-E2E-001',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            lines: [
              {
                damageLevel: 1,
                description: 'Servicio Reacondicionamiento Nivel 1 (Estético) - 1 equipo(s)',
                quantity: 1,
                unitPrice: 45.0,
                lineSubtotal: 45.0,
                mainCode: 'REP-N1',
                catalogItemId: null,
              },
            ],
            subtotal: 45.0,
            taxTotal: 6.75,
            grandTotal: 51.75,
            canInvoice: true,
            blockingReason: null,
            counterparty: {
              identificationType: '04',
              identification: '1790012345001',
              businessName: 'Whirlpool del Ecuador S.A.',
              address: 'Av. Juan Tanca Marengo Km 4.5',
              email: 'facturacion@whirlpool.ec',
              phone: '042999888',
            },
            additionalNote: 'Ref. Despacho DSP-2026-E2E-001 / Lote LOTE-E2E-2026-001',
          }),
        })
      })

      // 5. Mock de Facturación SRI
      await page.route('**/api/v1/tenants/tnt-e2e-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'tnt-e2e-1',
            name: 'Taller Central E2E',
            legalName: 'Taller Central S.A.',
            taxId: '1790010937001',
            establishmentCode: '001',
            address: 'Guayaquil, Ecuador',
            isRimpe: false,
            preferElectronicInvoice: true,
            salesDocumentKind: 'factura-electronica',
          }),
        })
      })

      await page.route('**/api/v1/emitters', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emitterId: 'em-e2e-1',
            ruc: '1790010937001',
            businessName: 'Taller Central S.A.',
          }),
        })
      })

      await page.route('**/api/v1/emitters/*/invoices', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            invoiceId: 'inv-e2e-draft-1',
            sequential: '001-001-000000042',
            state: 'Draft',
            grandTotal: 51.75,
            message: 'Borrador creado',
          }),
        })
      })

      await page.route('**/api/v1/emitters/*/invoices/*/preview-xml', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isValid: true,
            errors: [],
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/invoices', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'inv-e2e-draft-1',
            sequential: '001-001-000000042',
            status: 0,
            message: 'Borrador de factura guardado',
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/dispatches/dsp-e2e-001/invoice', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            dispatchId: 'dsp-e2e-001',
            invoiceId: 'inv-e2e-draft-1',
          }),
        })
      })

      // 6. Mock público de validación QR para comprobante y PDF
      await page.route('**/api/v1/public/repairs/verify-dispatch/hash-e2e-cert-9988', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            dispatchNumber: 'DSP-2026-E2E-001',
            customerName: 'Whirlpool del Ecuador S.A.',
            carrierName: 'Carlos Guamán',
            carrierVehiclePlate: 'GBA-4589',
            dispatchedAt: '2026-09-10T11:00:00Z',
            totalEquipments: 1,
            equipments: [
              {
                serialNumber: 'WP-E2E-001',
                brand: 'Whirlpool',
                model: 'LAVADORA XPERT 19KG',
                damageLevel: 'Nivel 1 (Leve)',
              },
            ],
          }),
        })
      })

      // ==========================================
      // PASO 1: Ingresar Lote mediante carga Excel
      // ==========================================
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await page.getByRole('button', { name: /Importar Lote/i }).click()
      await expect(page.getByRole('heading', { name: /Importar Lote de Reparación/i })).toBeVisible({ timeout: 15_000 })

      // Seleccionar cliente y número de lote
      await page.locator('#repair-customer').click()
      await page.getByRole('option', { name: /Whirlpool/i }).click()
      await page.locator('#repair-batch-num').fill('LOTE-E2E-2026-001')

      // Cargar archivo Excel y previsualizar
      const fileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]')
      await fileInput.setInputFiles({
        name: 'lote_ingreso.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock excel content'),
      })

      await expect(page.getByRole('heading', { name: /Previsualización del Lote/i })).toBeVisible()
      const confirmImportBtn = page.getByRole('button', { name: /Confirmar e Importar Lote/i })
      await expect(confirmImportBtn).toBeEnabled()
      await confirmImportBtn.click()

      // ===================================================
      // PASO 2: Control de estado del elemento en el lote
      // ===================================================
      await expect(page.getByRole('heading', { name: /Lote LOTE-E2E-2026-001/i })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('WP-E2E-001')).toBeVisible()

      // Abrir cambio de fase técnica
      const changeStatusBtn = page.getByRole('button', { name: /Cambiar estado \/ Fase técnica/i }).first()
      await expect(changeStatusBtn).toBeVisible()
      await changeStatusBtn.click()

      await expect(page.getByRole('heading', { name: /Fase Técnica — Serie WP-E2E-001/i })).toBeVisible()

      // Cambiar estado a "Listo para Retiro (Aprobado)"
      const targetStatusSelect = page.locator('#modal-target-status')
      await targetStatusSelect.click()
      await page.getByRole('option', { name: /4. Listo para Retiro/i }).click()

      const saveStatusBtn = page.getByRole('button', { name: /Confirmar Cambio de Estado/i })
      await saveStatusBtn.click()

      await expect(page.getByRole('heading', { name: /Fase Técnica — Serie WP-E2E-001/i })).not.toBeVisible()

      // ===============================================================
      // PASO 3: Despacho parcial con documento PDF y verificación QR
      // ===============================================================
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Despachos/i }).click()
      await page.getByRole('button', { name: /Nueva Acta/i }).first().click()

      await expect(page.getByRole('heading', { name: /Generar Acta de Despacho/i })).toBeVisible({ timeout: 15_000 })

      // Seleccionar el lote
      const batchSelect = page.locator('#create-dispatch-batch')
      await batchSelect.click()
      await page.getByRole('option', { name: /LOTE-E2E-2026-001/i }).click()

      // Verificar que el equipo listo aparece en la tabla
      await expect(page.getByText('WP-E2E-001', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

      // Llenar datos de transportista y vehículo
      await page.locator('#create-carrier-name').fill('Carlos Guamán')
      await page.locator('#create-carrier-doc').fill('0923456789')
      await page.locator('#create-carrier-plate').fill('GBA-4589')

      // Emitir acta de despacho
      const emitDispatchBtn = page.getByRole('button', { name: /Emitir acta/i })
      await expect(emitDispatchBtn).toBeEnabled()
      await emitDispatchBtn.click()

      // Vista de detalle del acta de despacho emitida
      await expect(page.getByRole('heading', { name: /Acta DSP-2026-E2E-001/i })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Carlos Guamán').first()).toBeVisible()
      await expect(page.getByText('GBA-4589').first()).toBeVisible()
      await expect(page.getByText('hash-e2e-cert-9988')).toBeVisible()
      await expect(page.getByRole('button', { name: /(Descargar|Imprimir) Acta \(PDF\)/i })).toBeVisible()

      // Validar vista pública imprimible de la entrega (PDF con QR)
      await page.goto('/verificar/despacho/hash-e2e-cert-9988')
      await expect(page.getByRole('heading', { name: /Acta de Despacho Certificada/i })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('WP-E2E-001', { exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Imprimir Comprobante de Entrega/i })).toBeVisible()

      // ========================================================
      // PASO 4: Facturación de la reparación / despacho SRI
      // ========================================================
      await page.goto('/taller/despachos/dsp-e2e-001')
      await expect(page.getByRole('heading', { name: /Acta DSP-2026-E2E-001/i })).toBeVisible({ timeout: 15_000 })

      // Validar vista previa con tarifario N1 ($45.00) e IVA 15% ($6.75)
      await expect(page.getByText(/Vista previa de factura/i)).toBeVisible()
      await expect(page.getByText(/\$45\.00/i).first()).toBeVisible()
      await expect(page.getByText(/\$51\.75/i).first()).toBeVisible()

      // Facturar despacho
      const invoiceDispatchBtn = page.getByRole('button', { name: /Facturar despacho/i })
      await expect(invoiceDispatchBtn).toBeVisible()
      await invoiceDispatchBtn.click()

      // Redirección hacia facturación de comprobantes
      await expect(page).toHaveURL(/\/facturacion\/comprobantes/, { timeout: 15_000 })
    })
  })
})
