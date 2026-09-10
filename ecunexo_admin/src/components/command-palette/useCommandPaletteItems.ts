import { useMemo, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppToast } from '@/components/toast'
import { buildSupportDiagnostics } from '@/config/appVersion'
import { applyEcuTheme, readCurrentTheme } from '@/lib/ecuTheme'
import {
  selectPermissions,
  selectTenantId,
  selectUserEmail,
  selectUserId,
  selectVisibleNavigation,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { NavigationNode } from '@/types/navigation'
import type { CommandPaletteItem } from './types'

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-mode'],
  })
  return () => observer.disconnect()
}

export interface UseCommandPaletteItemsOptions {
  readonly onOpenAbout?: () => void
  readonly onLogout?: () => void
}

export function useCommandPaletteItems({
  onOpenAbout,
  onLogout,
}: UseCommandPaletteItemsOptions = {}): CommandPaletteItem[] {
  const navigate = useNavigate()
  const toast = useAppToast()
  const navigation = useAppSelector(selectVisibleNavigation)
  const permissions = useAppSelector(selectPermissions)
  const tenantId = useAppSelector(selectTenantId)
  const userId = useAppSelector(selectUserId)
  const userEmail = useAppSelector(selectUserEmail)
  const currentTheme = useSyncExternalStore(subscribeTheme, readCurrentTheme)
  const isDark = currentTheme === 'dark'

  return useMemo(() => {
    const items: CommandPaletteItem[] = []
    const seenPaths = new Set<string>()

    const hasPerm = (code: string): boolean => {
      const lower = code.toLowerCase()
      return permissions.some((p) => p.toLowerCase() === lower)
    }

    // ── 1. ACCIONES RÁPIDAS ──────────────────────────────────────────
    // Nueva Factura
    if (hasPerm('facturacion.facturas.create') || hasPerm('facturacion.emisor.read') || hasPerm('facturacion.comprobantes.read')) {
      items.push({
        id: 'action-new-invoice',
        title: 'Emitir Factura Electrónica',
        subtitle: 'Crear y emitir comprobante digital autorizado por el SRI',
        category: 'Acciones Rápidas',
        icon: 'receipt',
        badge: 'SRI',
        keywords: ['factura', 'emitir', 'venta', 'sri', 'ride', 'comprobante', 'nueva'],
        onSelect: () => navigate('/facturacion/facturas/emitir'),
      })
    }

    // Nuevo Usuario
    if (hasPerm('identity.users.create') || hasPerm('identity.users.manage')) {
      items.push({
        id: 'action-new-user',
        title: 'Registrar Nuevo Usuario',
        subtitle: 'Crear credenciales, asignar perfil y departamento',
        category: 'Acciones Rápidas',
        icon: 'user-plus',
        badge: 'Equipo',
        keywords: ['usuario', 'crear', 'nuevo', 'invitar', 'colaborador', 'acceso', 'persona'],
        onSelect: () => navigate('/equipo/usuarios/nueva'),
      })
    }

    // Nuevo Rol
    if (hasPerm('identity.roles.manage') || hasPerm('identity.roles.create')) {
      items.push({
        id: 'action-new-role',
        title: 'Crear Nuevo Rol de Seguridad',
        subtitle: 'Definir perfil de permisos y políticas RBAC',
        category: 'Acciones Rápidas',
        icon: 'shield',
        badge: 'Seguridad',
        keywords: ['rol', 'permisos', 'seguridad', 'rbac', 'perfil', 'nuevo'],
        onSelect: () => navigate('/equipo/roles/nuevo'),
      })
    }

    // Nuevo Departamento
    if (hasPerm('identity.departments.manage') || hasPerm('identity.departments.create')) {
      items.push({
        id: 'action-new-department',
        title: 'Crear Departamento',
        subtitle: 'Añadir área o unidad operativa de la empresa',
        category: 'Acciones Rápidas',
        icon: 'building-2',
        badge: 'Equipo',
        keywords: ['departamento', 'area', 'unidad', 'seccion', 'nuevo'],
        onSelect: () => navigate('/equipo/departamentos/nuevo'),
      })
    }

    // Nuevo Item / Producto
    if (hasPerm('catalog.item.create') || hasPerm('catalog.product.create')) {
      items.push({
        id: 'action-new-catalog-item',
        title: 'Crear Producto o Servicio',
        subtitle: 'Añadir nuevo item al catálogo con códigos y tarifas SRI',
        category: 'Acciones Rápidas',
        icon: 'package',
        badge: 'Catálogo',
        keywords: ['producto', 'servicio', 'item', 'articulo', 'precio', 'catalogo', 'tarifa', 'iva', 'nuevo'],
        onSelect: () => navigate('/catalogo/items/nuevo'),
      })
    }

    // Nueva Categoría
    if (hasPerm('catalog.category.manage') || hasPerm('catalog.category.create')) {
      items.push({
        id: 'action-new-category',
        title: 'Crear Categoría de Catálogo',
        subtitle: 'Clasificar items en familias y grupos de productos',
        category: 'Acciones Rápidas',
        icon: 'folder-tree',
        badge: 'Catálogo',
        keywords: ['categoria', 'familia', 'grupo', 'clasificacion', 'catalogo', 'nueva'],
        onSelect: () => navigate('/catalogo/categorias/nueva'),
      })
    }

    // Nueva Bodega
    if (hasPerm('warehouses.manage') || hasPerm('inventory.stock.manage') || hasPerm('warehouses.create')) {
      items.push({
        id: 'action-new-warehouse',
        title: 'Registrar Nueva Bodega',
        subtitle: 'Añadir almacén físico o centro de despacho',
        category: 'Acciones Rápidas',
        icon: 'warehouse',
        badge: 'Bodegas',
        keywords: ['bodega', 'almacen', 'deposito', 'sucursal', 'inventario', 'nueva'],
        onSelect: () => navigate('/bodegas/nueva'),
      })
    }

    // Nuevo Movimiento de Inventario
    if (hasPerm('inventory.documents.create') || hasPerm('inventory.documents.manage')) {
      items.push({
        id: 'action-new-inventory-doc',
        title: 'Nuevo Movimiento de Inventario',
        subtitle: 'Registrar ingreso, egreso o transferencia física de stock',
        category: 'Acciones Rápidas',
        icon: 'file-text',
        badge: 'Inventario',
        keywords: ['movimiento', 'inventario', 'ingreso', 'egreso', 'transferencia', 'ajuste', 'kardex', 'stock', 'nuevo'],
        onSelect: () => navigate('/inventario/documentos/nuevo'),
      })
    }

    // Nueva Empresa
    if (hasPerm('tenancy.tenants.create') || hasPerm('tenancy.tenant.create') || hasPerm('tenancy.tenant.update')) {
      items.push({
        id: 'action-new-company',
        title: 'Registrar Nueva Empresa',
        subtitle: 'Añadir razón social o sucursal al tenant',
        category: 'Acciones Rápidas',
        icon: 'domain',
        badge: 'Organización',
        keywords: ['empresa', 'compania', 'ruc', 'razon social', 'filial', 'nueva'],
        onSelect: () => navigate('/organizacion/empresas/nueva'),
      })
    }

    // Nuevo Cliente Corporativo / Comercial
    if (hasPerm('repairs.batches.import') || hasPerm('repairs.batches.read')) {
      items.push({
        id: 'action-new-customer',
        title: 'Registrar Cliente / Aliado',
        subtitle: 'Alta de cliente corporativo con validación de cédula y RUC',
        category: 'Acciones Rápidas',
        icon: 'users',
        badge: 'Clientes',
        keywords: ['cliente', 'aliado', 'empresa', 'ruc', 'cedula', 'registro', 'nuevo', 'taller'],
        onSelect: () => navigate('/taller/clientes?nuevo=1'),
      })
    }

    // ── 2. NAVEGACIÓN Y VISTAS ───────────────────────────────────────
    // Dashboard principal
    seenPaths.add('/inicio')
    items.push({
      id: 'nav-dashboard',
      title: 'Panel Principal (Dashboard)',
      subtitle: 'Visión general de KPIs, actividad y accesos directos',
      category: 'Navegación',
      icon: 'dashboard',
      badge: 'Inicio',
      keywords: ['dashboard', 'inicio', 'panel', 'resumen', 'metricas', 'kpi'],
      onSelect: () => navigate('/inicio'),
    })

    // Función recursiva para mapear el árbol de navegación visible
    function traverseNavigation(nodes: NavigationNode[], parentLabel?: string) {
      for (const node of nodes) {
        if (node.disabled || node.placeholder) {
          continue
        }

        if (node.route) {
          const path = node.route.startsWith('/') ? node.route : `/${node.route}`
          if (!seenPaths.has(path)) {
            seenPaths.add(path)
            const subtitle = parentLabel ? `${parentLabel} · Módulo` : 'Sección principal'
            const keywords = [
              node.label.toLowerCase(),
              ...(parentLabel ? [parentLabel.toLowerCase()] : []),
              ...path.split('/').filter(Boolean),
            ]

            items.push({
              id: `nav-${node.id}`,
              title: node.label,
              subtitle,
              category: 'Navegación',
              icon: node.icon || 'list',
              badge: parentLabel ?? 'Página',
              keywords,
              onSelect: () => navigate(path),
            })
          }
        }

        if (node.children && node.children.length > 0) {
          traverseNavigation(node.children, node.label)
        }
      }
    }

    traverseNavigation(navigation)

    // Páginas institucionales clave
    if (!seenPaths.has('/app/configuracion') && hasPerm('platform.settings.read')) {
      seenPaths.add('/app/configuracion')
      items.push({
        id: 'nav-app-settings',
        title: 'Preferencias del Sistema',
        subtitle: 'Configuración general de interfaz y plataforma',
        category: 'Navegación',
        icon: 'sliders-horizontal',
        badge: 'Ajustes',
        keywords: ['preferencias', 'ajustes', 'configuracion', 'apariencia', 'plataforma'],
        onSelect: () => navigate('/app/configuracion'),
      })
    }

    if (!seenPaths.has('/organizacion/facturacion-electronica') && (hasPerm('facturacion.emisor.read') || hasPerm('tenancy.tenant.read'))) {
      seenPaths.add('/organizacion/facturacion-electronica')
      items.push({
        id: 'nav-electronic-billing',
        title: 'Facturación Electrónica & SRI',
        subtitle: 'Certificado digital (.p12), ambiente y datos de emisor',
        category: 'Navegación',
        icon: 'shield-check',
        badge: 'SRI',
        keywords: ['sri', 'firma', 'certificado', 'p12', 'facturacion', 'emisor', 'ambiente'],
        onSelect: () => navigate('/organizacion/facturacion-electronica'),
      })
    }

    if (!seenPaths.has('/organizacion/perfil') && hasPerm('tenancy.tenant.read')) {
      seenPaths.add('/organizacion/perfil')
      items.push({
        id: 'nav-org-profile',
        title: 'Perfil de la Organización',
        subtitle: 'Datos de la cuenta corporativa, logos e identificación',
        category: 'Navegación',
        icon: 'building-2',
        badge: 'Organización',
        keywords: ['perfil', 'organizacion', 'empresa', 'cuenta', 'logo'],
        onSelect: () => navigate('/organizacion/perfil'),
      })
    }

    if (!seenPaths.has('/organizacion/plan') && hasPerm('tenancy.tenant.read')) {
      seenPaths.add('/organizacion/plan')
      items.push({
        id: 'nav-org-plan',
        title: 'Plan & Suscripción',
        subtitle: 'Detalles del plan contratado, límites y facturación',
        category: 'Navegación',
        icon: 'library',
        badge: 'Cuenta',
        keywords: ['plan', 'licencia', 'suscripcion', 'limites', 'factura'],
        onSelect: () => navigate('/organizacion/plan'),
      })
    }

    // ── 3. SISTEMA Y PREFERENCIAS ────────────────────────────────────
    // Cambio de tema claro/oscuro
    items.push({
      id: 'system-theme-toggle',
      title: isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
      subtitle: isDark
        ? 'Activar paleta luminosa de alto contraste'
        : 'Activar paleta oscura para menor fatiga visual',
      category: 'Sistema y Preferencias',
      icon: isDark ? 'light_mode' : 'dark_mode',
      badge: 'Tema',
      keywords: ['tema', 'color', 'oscuro', 'claro', 'dark', 'light', 'modo', 'noche', 'dia'],
      onSelect: () => {
        const next = isDark ? 'light' : 'dark'
        applyEcuTheme(next)
        toast.info(
          next === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado',
          'Apariencia actualizada'
        )
      },
    })

    // Acerca de EcuNexo
    items.push({
      id: 'system-about',
      title: 'Acerca de EcuNexo & Novedades',
      subtitle: 'Versión v0.2.0 · Novedades, notas de release y soporte',
      category: 'Sistema y Preferencias',
      icon: 'sparkles',
      badge: 'v0.2.0',
      keywords: ['acerca', 'version', 'novedades', 'changelog', 'sistema', 'info', 'soporte', 'about'],
      onSelect: () => {
        onOpenAbout?.()
      },
    })

    // Copiar diagnóstico para soporte
    items.push({
      id: 'system-copy-diagnostics',
      title: 'Copiar Diagnóstico Técnico',
      subtitle: 'Copia resumen de inquilino, sesión y commit al portapapeles',
      category: 'Sistema y Preferencias',
      icon: 'copy',
      badge: 'Soporte',
      keywords: ['diagnostico', 'soporte', 'tecnico', 'id', 'inquilino', 'tenant', 'copiar'],
      onSelect: async () => {
        try {
          const diagnostics = buildSupportDiagnostics({ tenantId, userId, userEmail })
          await navigator.clipboard.writeText(diagnostics)
          toast.success(
            'Información técnica copiada al portapapeles.',
            'Diagnóstico listo'
          )
        } catch {
          toast.error('No se pudo copiar al portapapeles.', 'Error')
        }
      },
    })

    // Cerrar Sesión
    if (onLogout) {
      items.push({
        id: 'system-logout',
        title: 'Cerrar Sesión',
        subtitle: 'Finalizar la sesión de trabajo de forma segura',
        category: 'Sistema y Preferencias',
        icon: 'logout',
        badge: 'Sesión',
        keywords: ['salir', 'logout', 'cerrar sesion', 'desconectar', 'bloquear'],
        onSelect: onLogout,
      })
    }

    return items
  }, [
    navigation,
    permissions,
    tenantId,
    userId,
    userEmail,
    isDark,
    navigate,
    toast,
    onOpenAbout,
    onLogout,
  ])
}
