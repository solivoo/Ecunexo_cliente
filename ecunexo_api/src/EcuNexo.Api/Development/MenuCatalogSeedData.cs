using EcuNexo.Core.Platform.Navigation;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Api.Development;

internal static class MenuCatalogSeedData
{
    public static IReadOnlyList<(string Code, string DisplayName, string Description, string Module, int Sort)> Permissions =>
    [
        // Identidad / RBAC (obligatorios para Administrador al provisionar empresa)
        ("identity.users.read", "Usuarios — consultar", "Listar usuarios del tenant", "identity", 10),
        ("identity.users.create", "Usuarios — crear", "Crear usuarios", "identity", 11),
        ("identity.users.update", "Usuarios — editar", "Editar y deshabilitar usuarios", "identity", 12),
        ("identity.users.delete", "Usuarios — eliminar", "Eliminar usuarios", "identity", 13),
        ("identity.roles.read", "Roles — consultar", "Listar roles", "identity", 14),
        ("identity.roles.manage", "Roles — administrar", "Crear roles y asignar permisos/usuarios", "identity", 15),
        ("identity.permissions.read", "Permisos — consultar", "Ver catálogo de permisos", "identity", 16),
        ("identity.permissions.manage", "Permisos — administrar", "Crear permisos globales", "identity", 17),
        ("identity.policies.manage", "Políticas ABAC — administrar", "Crear y gestionar políticas", "identity", 18),
        ("identity.departments.read", "Departamentos — consultar", "Listar departamentos", "identity", 19),
        ("identity.departments.manage", "Departamentos — administrar", "Crear y editar departamentos", "identity", 20),

        // Organización (prefijo tenancy; no filtra por módulo de licencia)
        ("tenancy.tenant.read", "Empresa — consultar", "Ver perfil y plan de la empresa", "tenancy", 30),
        ("tenancy.tenant.update", "Empresa — editar", "Editar perfil y branding", "tenancy", 31),
        ("tenancy.license.apply", "Licencia — aplicar", "Aplicar upgrade de licencia", "tenancy", 32),
        ("tenancy.tenants.read", "Empresas — listar", "Listar empresas de la suscripción", "tenancy", 33),
        ("tenancy.tenants.create", "Empresas — crear", "Crear empresa bajo la licencia", "tenancy", 34),
        ("tenancy.tenants.update", "Empresas — editar", "Editar empresas de la suscripción", "tenancy", 35),
        ("tenancy.tenants.delete", "Empresas — eliminar", "Eliminar empresas de la suscripción", "tenancy", 36),

        ("platform.settings.read", "Ajustes — consultar", "Ver ajustes de plataforma", "platform", 40),
        ("platform.settings.update", "Ajustes — editar", "Editar ajustes de plataforma", "platform", 41),
        ("platform.menu.manage", "Menú — administrar", "Administrar ítems de menú", "platform", 42),

        ("facturacion.read", "Facturación — acceso", "Ver módulo facturación", "facturacion", 70),
        ("facturacion.comprobantes.read", "Comprobantes", "Ver comprobantes electrónicos", "facturacion", 71),
        ("facturacion.facturas.read", "Facturas — consultar propias", "Listar las facturas que emitió el usuario", "facturacion", 72),
        ("facturacion.facturas.read.all", "Facturas — consultar todas", "Ver todas las facturas del emisor, no solo las propias", "facturacion", 85),
        ("facturacion.facturas.create", "Facturas — crear", "Emitir factura", "facturacion", 73),
        ("facturacion.catalogos.read", "Catálogos — lectura", "Ver tarifas y reglas SRI", "facturacion", 74),
        ("facturacion.catalogos.write", "Catálogos — escritura", "Administrar tarifas y reglas SRI", "facturacion", 75),
        ("facturacion.emisor.read", "Emisor — lectura", "Ver datos del emisor", "facturacion", 76),
        ("facturacion.emisor.certificates", "Emisor — certificado", "Certificado digital", "facturacion", 77),
        ("facturacion.sri.read", "SRI — monitoreo", "Estados SRI", "facturacion", 78),
        ("facturacion.notas.credito.read", "NC — lectura", "Notas de crédito SRI 04", "facturacion", 79),
        ("facturacion.notas.debito.read", "ND — lectura", "Notas de débito SRI 05", "facturacion", 80),
        ("facturacion.guias.remision.read", "Guías — lectura", "Guías de remisión SRI 06", "facturacion", 81),
        ("facturacion.retenciones.read", "Retenciones — lectura", "Comprobantes retención SRI 07", "facturacion", 82),
        ("facturacion.liquidacion.compra.read", "Liquidación — lectura", "Liquidación compra SRI 03", "facturacion", 83),
        ("facturacion.emisor.write", "Emisor — escritura", "Registrar emisor", "facturacion", 84),

        ("catalog.read", "Catálogo — acceso", "Ver módulo catálogo", "catalog", 60),
        ("catalog.item.read", "Ítems — consultar", "Listar ítems del catálogo", "catalog", 61),
        ("catalog.item.create", "Ítems — crear", "Crear ítems del catálogo", "catalog", 62),
        ("catalog.item.update", "Ítems — editar", "Editar ítems del catálogo", "catalog", 63),
        ("catalog.item.delete", "Ítems — eliminar", "Baja lógica de ítems sin uso", "catalog", 64),
        ("catalog.category.manage", "Categorías — administrar", "Crear y editar categorías", "catalog", 65),

        ("warehousing.read", "Bodegas — acceso", "Ver módulo bodegas", "warehousing", 100),
        ("warehousing.locations.manage", "Bodegas — administrar", "Crear y editar ubicaciones", "warehousing", 101),
        ("warehousing.warehouse.manage", "Bodegas — administrar", "Crear y editar bodegas", "warehousing", 102),

        ("inventory.read", "Inventario — acceso", "Ver módulo inventario", "inventory", 110),
        ("inventory.stock.read", "Stock — consultar", "Ver saldos por bodega", "inventory", 111),
        ("inventory.stock.manage", "Stock — umbrales", "Definir stock mínimo / alertas", "inventory", 112),
        ("inventory.documents.create", "Documentos — crear", "Crear documentos logísticos", "inventory", 113),
        ("inventory.documents.approve", "Documentos — aprobar", "Aprobar documentos (kárdex)", "inventory", 114),
        ("inventory.movement.read", "Kárdex — consultar", "Ver movimientos de inventario", "inventory", 115),

        ("contabilidad.read", "Contabilidad — acceso", "Ver módulo contabilidad", "contabilidad", 90),
        ("contabilidad.asientos.read", "Asientos — lectura", "Ver asientos contables", "contabilidad", 91),
        ("contabilidad.ejercicios.read", "Ejercicios — lectura", "Ver ejercicios contables", "contabilidad", 92),
        ("contabilidad.plan.contable.read", "Plan contable — lectura", "Ver plan de cuentas", "contabilidad", 93),
        ("contabilidad.balances.read", "Balances — lectura", "Ver balances", "contabilidad", 94),
        ("contabilidad.declaraciones.read", "Declaraciones — lectura", "Ver declaraciones", "contabilidad", 95),
        ("contabilidad.cuentas.read", "Cuentas — lectura", "Ver cuentas contables", "contabilidad", 96),
        ("contabilidad.reportes.read", "Reportes contables — lectura", "Ver reportes contables", "contabilidad", 97),
        ("contabilidad.configuracion.read", "Config. contabilidad — lectura", "Ver configuración contable", "contabilidad", 98),

        ("repairs.batches.read", "Lotes — lectura", "Consultar lotes de reparación", "repairs", 120),
        ("repairs.batches.import", "Lotes — importar", "Importar lotes masivos de equipos", "repairs", 121),
        ("repairs.equipments.update.status", "Equipos — gestionar estado", "Cambiar fases de diagnóstico y reparación", "repairs", 122),
        ("repairs.dispatches.create", "Despachos — emitir", "Generar actas de entrega y despachos QR", "repairs", 123),
        ("repairs.dispatches.read", "Despachos — lectura", "Consultar actas y despachos", "repairs", 124),
        ("repairs.b2b.portal.view", "Portal B2B — auditoría", "Portal exclusivo cliente corporativo Whirlpool", "repairs", 125),
    ];

    public static IReadOnlyList<(string Code, string DisplayName)> ProductModules =>
    [
        ("identity", "Identidad y acceso"),
        ("tenancy", "Organización"),
        ("catalog", "Catálogo"),
        ("warehousing", "Bodegas"),
        ("inventory", "Inventario"),
        ("facturacion", "Facturación electrónica"),
        ("contabilidad", "Contabilidad"),
        ("repairs", "Taller y Reparaciones B2B"),
    ];

    public static IReadOnlyList<MenuItem> MenuItems =>
    [
        // —— Operacional (tenant / empresa) ——
        // Sin bloque "Organización" con listado/plan: eso es del titular (Subscription).
        Item("home", null, "Inicio", "dashboard", "inicio", 10, MenuContextKind.Operational, "identity", []),
        Item("team", null, "Equipo", "group", null, 30, MenuContextKind.Operational, "identity", []),
        Item("team-users", "team", "Usuarios", "group", "equipo/usuarios", 1, MenuContextKind.Operational, "identity", ["identity.users.read"]),
        Item("team-roles", "team", "Roles", "admin_panel_settings", "equipo/roles", 2, MenuContextKind.Operational, "identity", ["identity.roles.read"]),
        Item("team-departments", "team", "Departamentos", "building-2", "equipo/departamentos", 3, MenuContextKind.Operational, "identity", ["identity.departments.read"]),
        Item("security", null, "Seguridad", "shield", null, 40, MenuContextKind.Operational, "identity", []),
        Item("security-permissions", "security", "Permisos globales", "key", "seguridad/permisos", 1, MenuContextKind.Operational, "identity", ["identity.permissions.read"]),
        Item("catalog", null, "Catálogo", "inventory_2", null, 50, MenuContextKind.Operational, "catalog", ["catalog.item.read", "catalog.product.read"]),
        Item("catalog-items", "catalog", "Ítems", "package", "catalogo/items", 1, MenuContextKind.Operational, "catalog", ["catalog.item.read", "catalog.product.read"]),
        Item("catalog-categories", "catalog", "Categorías", "folder-tree", "catalogo/categorias", 2, MenuContextKind.Operational, "catalog", ["catalog.item.read", "catalog.category.manage", "catalog.product.read"]),

        Item("warehousing", null, "Bodegas", "warehouse", null, 52, MenuContextKind.Operational, "warehousing", ["warehousing.read"]),
        Item("warehousing-list", "warehousing", "Ubicaciones", "warehouse", "bodegas", 1, MenuContextKind.Operational, "warehousing", ["warehousing.read", "warehousing.locations.manage"]),

        Item("inventory", null, "Inventario", "package", null, 54, MenuContextKind.Operational, "inventory", ["inventory.stock.read", "inventory.read"]),
        Item("inventory-stock", "inventory", "Stock", "package", "inventario/stock", 1, MenuContextKind.Operational, "inventory", ["inventory.stock.read"]),
        Item("inventory-documents", "inventory", "Documentos", "file-text", "inventario/documentos", 2, MenuContextKind.Operational, "inventory", ["inventory.documents.create", "inventory.documents.approve", "inventory.stock.read"]),
        Item("inventory-kardex", "inventory", "Kárdex", "list", "inventario/kardex", 3, MenuContextKind.Operational, "inventory", ["inventory.movement.read", "inventory.stock.read"]),

        Item("repairs", null, "Taller B2B", "build", null, 56, MenuContextKind.Operational, "repairs", ["repairs.batches.read"]),
        Item("repairs-batches", "repairs", "Lotes de Equipos", "layers", "taller/lotes", 1, MenuContextKind.Operational, "repairs", ["repairs.batches.read"]),
        Item("repairs-dispatches", "repairs", "Actas y Despachos", "truck", "taller/despachos", 2, MenuContextKind.Operational, "repairs", ["repairs.dispatches.create", "repairs.batches.read"]),
        Item("repairs-portal", "repairs", "Portal Whirlpool", "eye", "taller/portal", 3, MenuContextKind.Operational, "repairs", ["repairs.b2b.portal.view"]),

        Item("facturacion", null, "Facturación", "receipt", null, 60, MenuContextKind.Operational, "facturacion", ["facturacion.read"]),
        Item("facturacion-comprobantes", "facturacion", "Comprobantes", "file-text", "facturacion/comprobantes", 1, MenuContextKind.Operational, "facturacion", ["facturacion.comprobantes.read", "facturacion.facturas.read", "facturacion.facturas.read.all"]),
        Item("facturacion-emisor-config", "facturacion", "Emisor y SRI", "settings", "organizacion/facturacion-electronica", 2, MenuContextKind.Operational, "facturacion", ["facturacion.emisor.read", "tenancy.tenant.read", "contabilidad.configuracion.read"]),
        Item("facturacion-sri", "facturacion", "Monitoreo SRI", "shield-check", "facturacion/sri", 3, MenuContextKind.Operational, "facturacion", ["facturacion.sri.read"]),
        Item("facturacion-catalogos", "facturacion", "Catálogos", "library", null, 4, MenuContextKind.Operational, "facturacion", ["facturacion.catalogos.read"]),
        Item("facturacion-catalogos-reglas", "facturacion-catalogos", "Reglas SRI", null, "facturacion/catalogos/reglas", 1, MenuContextKind.Operational, "facturacion", ["facturacion.catalogos.read"]),

        // Compras: misma licencia de facturación (no es un SKU aparte). Retención 07 y liquidación 03.
        Item("compras", null, "Compras", "shopping-cart", null, 65, MenuContextKind.Operational, "facturacion", ["facturacion.read"]),
        Item("compras-documentos", "compras", "Documentos", "file-text", "compras/documentos", 1, MenuContextKind.Operational, "facturacion", ["facturacion.read"]),
        Item("compras-retenciones", "compras", "Retenciones", "receipt", "compras/retenciones", 2, MenuContextKind.Operational, "facturacion", ["facturacion.retenciones.read", "facturacion.read"]),
        Item("compras-liquidaciones", "compras", "Liquidaciones", "file-text", "compras/liquidaciones", 3, MenuContextKind.Operational, "facturacion", ["facturacion.liquidacion.compra.read", "facturacion.read"]),

        // —— Contabilidad (tenant admin SPA) ——
        Item("contabilidad", null, "Contabilidad", "calculator", null, 70, MenuContextKind.Operational, "contabilidad", ["contabilidad.read"]),
        Item("contabilidad-asientos", "contabilidad", "Asientos", null, "contabilidad/asientos", 1, MenuContextKind.Operational, "contabilidad", ["contabilidad.asientos.read"]),
        Item("contabilidad-ejercicios", "contabilidad", "Ejercicios", null, "contabilidad/ejercicios", 2, MenuContextKind.Operational, "contabilidad", ["contabilidad.ejercicios.read"]),
        Item("contabilidad-plan-contable", "contabilidad", "Plan contable", null, "contabilidad/plan-contable", 3, MenuContextKind.Operational, "contabilidad", ["contabilidad.plan.contable.read"]),
        Item("contabilidad-balances", "contabilidad", "Balances", null, "contabilidad/balances", 4, MenuContextKind.Operational, "contabilidad", ["contabilidad.balances.read"]),
        Item("contabilidad-declaraciones", "contabilidad", "Declaraciones", null, "contabilidad/declaraciones", 5, MenuContextKind.Operational, "contabilidad", ["contabilidad.declaraciones.read"]),
        Item("contabilidad-cuentas", "contabilidad", "Cuentas", null, "contabilidad/cuentas", 6, MenuContextKind.Operational, "contabilidad", ["contabilidad.cuentas.read"]),
        Item("contabilidad-reportes", "contabilidad", "Reportes", null, "contabilidad/reportes", 7, MenuContextKind.Operational, "contabilidad", ["contabilidad.reportes.read"]),
        Item("contabilidad-configuracion", "contabilidad", "Configuración", null, null, 8, MenuContextKind.Operational, "contabilidad", ["contabilidad.configuracion.read"]),
        Item("contabilidad-configuracion-impuestos", "contabilidad-configuracion", "Impuestos", null, "contabilidad/configuracion/impuestos", 2, MenuContextKind.Operational, "contabilidad", ["contabilidad.configuracion.read"]),

        // —— Configuración de Empresa (sidebar operativo; GetSession solo carga Operational) ——
        Item("configuracion", null, "Ajustes de Empresa", "settings", null, 90, MenuContextKind.Operational, "identity", ["tenancy.tenant.read", "facturacion.emisor.read", "contabilidad.configuracion.read"]),
        Item("configuracion-empresa", "configuracion", "Empresa", "domain", "organizacion/perfil", 1, MenuContextKind.Operational, "identity", ["tenancy.tenant.read"]),
        Item("configuracion-facturacion-electronica", "configuracion", "Facturación electrónica", "receipt", "organizacion/facturacion-electronica", 2, MenuContextKind.Operational, "facturacion", ["facturacion.emisor.read", "tenancy.tenant.read", "contabilidad.configuracion.read"]),

        // —— Suscripción (titular de licencia, sin tenant operativo) ——
        Item("sub-home", null, "Inicio", "dashboard", "inicio", 10, MenuContextKind.Subscription, "identity", []),
        Item("sub-org", null, "Organización", "domain", null, 20, MenuContextKind.Subscription, "identity", []),
        Item("sub-companies", "sub-org", "Listado de empresas", "building-2", "organizacion/empresas", 1, MenuContextKind.Subscription, "identity", ["tenancy.tenants.read"]),
        Item("sub-plan", "sub-org", "Plan y licencia", "analytics", "organizacion/plan", 3, MenuContextKind.Subscription, "identity", ["tenancy.tenant.read"]),
    ];

    /// <summary>Ítems retirados del menú SPA; el seeder los desactiva en Development.</summary>
    public static IReadOnlyList<string> RetiredMenuItemIds { get; } =
    [
        "org",
        "org-profile",
        "org-companies",
        "org-plan",
        "org-settings",
        "org-companies-create",
        "org-companies-list",
        "sub-companies-create",
        "sub-companies-list",
        "configuracion-empleados",
        "configuracion-roles",
        "configuracion-permisos",
        "configuracion-politicas",
        "facturacion-facturas",
        "facturacion-facturas-emitir",
        "facturacion-facturas-consultar",
        "facturacion-notas-credito",
        "facturacion-notas-debito",
        "facturacion-guias-remision",
        "facturacion-retenciones",
        "facturacion-liquidacion-compra",
        "facturacion-catalogos-tarifas",
        "facturacion-catalogos-retenciones",
        "facturacion-emisor",
        "facturacion-emisor-datos",
        "facturacion-emisor-certificado",
        "contabilidad-configuracion-sri",
        "facturacion-config",
        "facturacion-config-impuestos",
        "catalog-soon",
    ];

    private static MenuItem Item(
        string id,
        string? parentId,
        string label,
        string? icon,
        string? route,
        int sortOrder,
        MenuContextKind context,
        string moduleCode,
        string[] permissions,
        MenuPositionKind position = MenuPositionKind.Top,
        bool isPlaceholder = false) =>
        new()
        {
            Id = TenantModuleCodes.Normalize(id),
            ParentId = parentId is null ? null : TenantModuleCodes.Normalize(parentId),
            Label = label,
            Icon = icon,
            Route = route,
            SortOrder = sortOrder,
            Context = context,
            ModuleCode = TenantModuleCodes.Canonicalize(moduleCode),
            Position = position,
            RequiredPermissions = permissions,
            IsActive = true,
            IsPlaceholder = isPlaceholder,
        };
}
