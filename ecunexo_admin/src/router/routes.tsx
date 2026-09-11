import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import LoginLayout from '@/layout/LoginLayout'
import WelcomeLayout from '@/layout/WelcomeLayout'
import WelcomeOnboardingPage from '@/pages/auth/WelcomeOnboardingPage'
import { DashboardPage } from '@/pages/Dashboard/DashboardPage'
import { OrganizationPlanPage } from '@/pages/organization/OrganizationPlanPage'
import { CompaniesListPage } from '@/pages/organization/CompaniesListPage'
import { CreateCompanyPage } from '@/pages/organization/CreateCompanyPage'
import { EditCompanyPage } from '@/pages/organization/EditCompanyPage'
import { OrganizationProfilePage } from '@/pages/organization/OrganizationProfilePage'
import { OrganizationSettingsPage } from '@/pages/organization/OrganizationSettingsPage'
import { AppSettingsPage } from '@/pages/settings/AppSettingsPage'
import { PermissionDetailPage } from '@/pages/security/PermissionDetailPage'
import { PermissionsCatalogPage } from '@/pages/security/PermissionsCatalogPage'
import { CreatePermissionPage } from '@/pages/security/CreatePermissionPage'
import { AssignUserRolePage } from '@/pages/team/AssignUserRolePage'
import { CreateDepartmentPage } from '@/pages/team/CreateDepartmentPage'
import { CreateRolePage } from '@/pages/team/CreateRolePage'
import { EditRolePage } from '@/pages/team/EditRolePage'
import { CreateUserPage } from '@/pages/team/CreateUserPage'
import { DepartmentsListPage } from '@/pages/team/DepartmentsListPage'
import { EditDepartmentPage } from '@/pages/team/EditDepartmentPage'
import { EditUserPage } from '@/pages/team/EditUserPage'
import { GrantRolePermissionPage } from '@/pages/team/GrantRolePermissionPage'
import { ResetUserPasswordPage } from '@/pages/team/ResetUserPasswordPage'
import { RoleDetailPage } from '@/pages/team/RoleDetailPage'
import { RolePermissionsPage } from '@/pages/team/RolePermissionsPage'
import { RolesListPage } from '@/pages/team/RolesListPage'
import { UserDetailPage } from '@/pages/team/UserDetailPage'
import { UsersListPage } from '@/pages/team/UsersListPage'
import { CreateCatalogItemPage } from '@/pages/catalog/CreateCatalogItemPage'
import { CatalogItemsListPage } from '@/pages/catalog/CatalogItemsListPage'
import { CategoriesListPage } from '@/pages/catalog/CategoriesListPage'
import { CreateCategoryPage } from '@/pages/catalog/CreateCategoryPage'
import { EditCatalogItemPage } from '@/pages/catalog/EditCatalogItemPage'
import { EditCategoryPage } from '@/pages/catalog/EditCategoryPage'
import { CreateInventoryDocumentPage } from '@/pages/inventory/CreateInventoryDocumentPage'
import { InventoryDocumentDetailPage } from '@/pages/inventory/InventoryDocumentDetailPage'
import { InventoryDocumentsListPage } from '@/pages/inventory/InventoryDocumentsListPage'
import { InventoryKardexPage } from '@/pages/inventory/InventoryKardexPage'
import { StockListPage } from '@/pages/inventory/StockListPage'
import { CreateWarehousePage } from '@/pages/warehousing/CreateWarehousePage'
import { EditWarehousePage } from '@/pages/warehousing/EditWarehousePage'
import { WarehousesListPage } from '@/pages/warehousing/WarehousesListPage'
import { ModulePlaceholderPage } from '@/pages/placeholder/ModulePlaceholderPage'
import { CompanyElectronicBillingPage } from '@/pages/organization/CompanyElectronicBillingPage'
import { FacturaEmitirPage } from '@/pages/facturacion/FacturaEmitirPage'
import { ComprobantesPage } from '@/pages/facturacion/ComprobantesPage'
import { SriMonitorPage } from '@/pages/facturacion/SriMonitorPage'
import { TaxRulesCatalogPage } from '@/pages/facturacion/TaxRulesCatalogPage'
import { ComprasDocumentosPage } from '@/pages/compras/ComprasDocumentosPage'
import { RepairsBatchesListPage } from '@/pages/repairs/RepairsBatchesListPage'
import { CreateRepairBatchPage } from '@/pages/repairs/CreateRepairBatchPage'
import { CreateRepairDispatchPage } from '@/pages/repairs/CreateRepairDispatchPage'
import { RepairBatchDetailPage } from '@/pages/repairs/RepairBatchDetailPage'
import { RepairDispatchesListPage } from '@/pages/repairs/RepairDispatchesListPage'
import { RepairDispatchDetailPage } from '@/pages/repairs/RepairDispatchDetailPage'
import { WhirlpoolPortalPage } from '@/pages/repairs/WhirlpoolPortalPage'
import RepairCustomersListPage from '@/pages/repairs/RepairCustomersListPage'
import CustomerTypesListPage from '@/pages/customers/CustomerTypesListPage'
import { PublicDispatchVerificationPage } from '@/pages/repairs/PublicDispatchVerificationPage'
import { DashboardLayout } from '@/shell/DashboardLayout'

const placeholder = (title: string): RouteObject => ({
  element: <ModulePlaceholderPage />,
  handle: { title },
})

export const routes: RouteObject[] = [
  { path: '/', element: <LoginLayout /> },
  { path: '/verificar/despacho/:verificationHash', element: <PublicDispatchVerificationPage /> },
  {
    path: '/bienvenida',
    element: <WelcomeLayout />,
    children: [{ index: true, element: <WelcomeOnboardingPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: 'inicio', element: <DashboardPage /> },
          { path: 'organizacion/perfil', element: <OrganizationProfilePage /> },
          {
            path: 'organizacion/facturacion-electronica',
            element: <CompanyElectronicBillingPage />,
          },
          { path: 'organizacion/empresas', element: <CompaniesListPage /> },
          { path: 'organizacion/empresas/nueva', element: <CreateCompanyPage /> },
          { path: 'organizacion/empresas/:companyId/editar', element: <EditCompanyPage /> },
          { path: 'organizacion/plan', element: <OrganizationPlanPage /> },
          { path: 'organizacion/configuracion', element: <OrganizationSettingsPage /> },
          { path: 'app/configuracion', element: <AppSettingsPage /> },
          { path: 'equipo/usuarios', element: <UsersListPage /> },
          { path: 'equipo/usuarios/nueva', element: <CreateUserPage /> },
          { path: 'equipo/usuarios/:userId/editar', element: <EditUserPage /> },
          { path: 'equipo/usuarios/:userId/contrasena', element: <ResetUserPasswordPage /> },
          { path: 'equipo/usuarios/:userId/roles/asignar', element: <AssignUserRolePage /> },
          { path: 'equipo/usuarios/:userId', element: <UserDetailPage /> },
          { path: 'equipo/roles', element: <RolesListPage /> },
          { path: 'equipo/roles/nuevo', element: <CreateRolePage /> },
          { path: 'equipo/roles/:roleId/editar', element: <EditRolePage /> },
          { path: 'equipo/roles/:roleId/permisos', element: <RolePermissionsPage /> },
          { path: 'equipo/roles/:roleId/permisos/otorgar', element: <GrantRolePermissionPage /> },
          { path: 'equipo/roles/:roleId', element: <RoleDetailPage /> },
          { path: 'equipo/departamentos', element: <DepartmentsListPage /> },
          { path: 'equipo/departamentos/nuevo', element: <CreateDepartmentPage /> },
          { path: 'equipo/departamentos/:departmentId/editar', element: <EditDepartmentPage /> },
          { path: 'seguridad/permisos', element: <PermissionsCatalogPage /> },
          { path: 'seguridad/permisos/nuevo', element: <CreatePermissionPage /> },
          { path: 'seguridad/permisos/:permissionId', element: <PermissionDetailPage /> },
          { path: 'catalogo', element: <Navigate to="/catalogo/items" replace /> },
          { path: 'catalogo/items', element: <CatalogItemsListPage /> },
          { path: 'catalogo/items/nuevo', element: <CreateCatalogItemPage /> },
          { path: 'catalogo/items/:itemId', element: <EditCatalogItemPage /> },
          { path: 'catalogo/categorias', element: <CategoriesListPage /> },
          { path: 'catalogo/categorias/nueva', element: <CreateCategoryPage /> },
          { path: 'catalogo/categorias/:categoryId/editar', element: <EditCategoryPage /> },
          { path: 'bodegas', element: <WarehousesListPage /> },
          { path: 'bodegas/nueva', element: <CreateWarehousePage /> },
          { path: 'bodegas/:warehouseId', element: <EditWarehousePage /> },
          { path: 'inventario/stock', element: <StockListPage /> },
          { path: 'inventario/documentos', element: <InventoryDocumentsListPage /> },
          { path: 'inventario/documentos/nuevo', element: <CreateInventoryDocumentPage /> },
          { path: 'inventario/documentos/:documentId', element: <InventoryDocumentDetailPage /> },
          { path: 'inventario/kardex', element: <InventoryKardexPage /> },
          { path: 'taller', element: <Navigate to="/taller/lotes" replace /> },
          { path: 'taller/lotes', element: <RepairsBatchesListPage /> },
          { path: 'taller/lotes/nuevo', element: <CreateRepairBatchPage /> },
          { path: 'taller/lotes/:batchId', element: <RepairBatchDetailPage /> },
          { path: 'taller/despachos', element: <RepairDispatchesListPage /> },
          { path: 'taller/despachos/nuevo', element: <CreateRepairDispatchPage /> },
          { path: 'taller/despachos/:dispatchId', element: <RepairDispatchDetailPage /> },
          { path: 'taller/portal', element: <WhirlpoolPortalPage /> },
          { path: 'taller/clientes', element: <Navigate to="/clientes" replace /> },
          { path: 'clientes', element: <RepairCustomersListPage /> },
          { path: 'clientes/tipos', element: <CustomerTypesListPage /> },
          { path: 'compras/documentos', element: <ComprasDocumentosPage /> },
          { path: 'compras/retenciones', element: <ComprasDocumentosPage /> },
          { path: 'compras/liquidaciones', element: <ComprasDocumentosPage /> },
          { path: 'facturacion/comprobantes', element: <ComprobantesPage /> },
          { path: 'facturacion/facturas/emitir', element: <FacturaEmitirPage /> },
          {
            path: 'facturacion/emisor',
            element: <Navigate to="/organizacion/facturacion-electronica" replace />,
          },
          { path: 'facturacion/sri', element: <SriMonitorPage /> },
          { path: 'facturacion/catalogos/reglas', element: <TaxRulesCatalogPage /> },
          {
            path: 'facturacion/facturas/consultar',
            element: <Navigate to="/facturacion/comprobantes" replace />,
          },
          {
            path: 'facturacion/notas-credito',
            element: <Navigate to="/facturacion/comprobantes?tipo=04" replace />,
          },
          {
            path: 'facturacion/notas-debito',
            element: <Navigate to="/facturacion/comprobantes?tipo=05" replace />,
          },
          {
            path: 'facturacion/guias-remision',
            element: <Navigate to="/facturacion/comprobantes?tipo=06" replace />,
          },
          {
            path: 'facturacion/retenciones',
            element: <Navigate to="/compras/retenciones" replace />,
          },
          {
            path: 'facturacion/liquidacion-compra',
            element: <Navigate to="/compras/liquidaciones" replace />,
          },
          {
            path: 'facturacion/liquidaciones',
            element: <Navigate to="/compras/liquidaciones" replace />,
          },
          {
            path: 'facturacion/sri/estados',
            element: <Navigate to="/facturacion/sri" replace />,
          },
          {
            path: 'facturacion/emisor/datos',
            element: <Navigate to="/organizacion/facturacion-electronica" replace />,
          },
          {
            path: 'facturacion/emisor/certificado',
            element: <Navigate to="/organizacion/facturacion-electronica" replace />,
          },
          {
            path: 'facturacion/catalogos/tarifas',
            element: <Navigate to="/facturacion/comprobantes" replace />,
          },
          {
            path: 'facturacion/catalogos/retenciones',
            element: <Navigate to="/facturacion/comprobantes" replace />,
          },
          { path: 'contabilidad/asientos', ...placeholder('Asientos') },
          { path: 'contabilidad/ejercicios', ...placeholder('Ejercicios') },
          { path: 'contabilidad/plan-contable', ...placeholder('Plan contable') },
          { path: 'contabilidad/balances', ...placeholder('Balances') },
          { path: 'contabilidad/declaraciones', ...placeholder('Declaraciones') },
          { path: 'contabilidad/cuentas', ...placeholder('Cuentas') },
          { path: 'contabilidad/reportes', ...placeholder('Reportes') },
          {
            path: 'contabilidad/configuracion/sri',
            element: <Navigate to="/organizacion/facturacion-electronica" replace />,
          },
          { path: 'contabilidad/configuracion/impuestos', ...placeholder('Impuestos') },
        ],
      },
    ],
  },
]
