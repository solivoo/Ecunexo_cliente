using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Identity.ApiKeys;

public sealed record DeveloperApiScopeDefinition(
    string Code,
    string ModuleCode,
    string ModuleLabel,
    string Title,
    string Description);

/// <summary>
/// Catálogo cerrado de permisos (scopes) que pueden asignarse a una <c>TenantApiKey</c> para integraciones externas.
/// Impide escalación de privilegios hacia administración de identidad, plataforma o licencias.
/// </summary>
public static class DeveloperApiScopes
{
    public static readonly IReadOnlyList<DeveloperApiScopeDefinition> All =
    [
        // Catálogo
        new(
            "catalog.item.read",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Leer productos y catálogo",
            "Permite listar y consultar ítems del catálogo, variantes y plantillas."),
        new(
            "catalog.item.create",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Crear productos",
            "Permite registrar nuevos productos, matrices de variantes y multimedia."),
        new(
            "catalog.item.update",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Actualizar productos",
            "Permite modificar productos existentes, variantes e imágenes."),
        new(
            "catalog.item.delete",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Eliminar productos",
            "Permite dar de baja lógica (soft-delete) ítems del catálogo."),

        // Precios y Promociones
        new(
            "catalog.pricing.read",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Leer listas de precios y promociones",
            "Permite consultar listas de precios, precios por producto, promociones y resolver precios."),
        new(
            "catalog.pricing.create",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Crear listas de precios y precios",
            "Permite crear listas de precios, carga masiva de precios y promociones."),
        new(
            "catalog.pricing.update",
            TenantModuleCodes.Catalog,
            "Catálogo y Precios",
            "Actualizar precios y promociones",
            "Permite actualizar precios de productos, listas y promociones."),

        // Inventario
        new(
            "inventory.stock.read",
            TenantModuleCodes.Inventory,
            "Inventario",
            "Consultar existencias (Stock)",
            "Permite consultar saldos de stock por bodega y documentos de inventario."),
        new(
            "inventory.movement.read",
            TenantModuleCodes.Inventory,
            "Inventario",
            "Consultar movimientos de kardex",
            "Permite listar movimientos históricos de inventario."),
        new(
            "inventory.documents.create",
            TenantModuleCodes.Inventory,
            "Inventario",
            "Crear documentos de inventario",
            "Permite registrar ingresos, egresos y transferencias en borrador."),
        new(
            "inventory.documents.approve",
            TenantModuleCodes.Inventory,
            "Inventario",
            "Aprobar documentos y ajustar stock",
            "Permite aprobar documentos de inventario, recibir transferencias y configurar stock mínimo."),

        // Bodegas
        new(
            "warehousing.read",
            TenantModuleCodes.Warehousing,
            "Bodegas",
            "Consultar bodegas",
            "Permite listar y consultar el detalle de las bodegas de la empresa."),
        new(
            "warehousing.warehouse.manage",
            TenantModuleCodes.Warehousing,
            "Bodegas",
            "Gestionar bodegas",
            "Permite crear y actualizar bodegas."),

        // Clientes
        new(
            "customers.read",
            TenantModuleCodes.Customers,
            "Clientes",
            "Consultar clientes",
            "Permite listar clientes, buscar por ID o identificación fiscal (RUC/Cédula)."),
        new(
            "customers.manage",
            TenantModuleCodes.Customers,
            "Clientes",
            "Crear y actualizar clientes",
            "Permite registrar nuevos clientes y actualizar su información comercial."),

        // Pedidos / Ecommerce
        new(
            "ecommerce.orders.read",
            TenantModuleCodes.Orders,
            "Pedidos y E-commerce",
            "Consultar pedidos",
            "Permite listar pedidos, ver detalle y consultar métricas de órdenes."),
        new(
            "ecommerce.orders.create",
            TenantModuleCodes.Orders,
            "Pedidos y E-commerce",
            "Crear pedidos",
            "Permite registrar nuevos pedidos desde canales externos."),
        new(
            "ecommerce.orders.manage",
            TenantModuleCodes.Orders,
            "Pedidos y E-commerce",
            "Gestionar ciclo de vida de pedidos",
            "Permite confirmar pago, procesar, despachar, entregar o cancelar pedidos."),
    ];

    private static readonly HashSet<string> AllowedCodes = new(
        All.Select(static s => s.Code),
        StringComparer.OrdinalIgnoreCase);

    public static bool IsAllowed(string permissionCode) =>
        !string.IsNullOrWhiteSpace(permissionCode)
        && AllowedCodes.Contains(permissionCode.Trim());
}
