using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace EcuNexo.Api.Security;

/// <summary>
/// Marca un endpoint o grupo de rutas para ser incluido en el documento OpenAPI público de integraciones (<c>external-v1</c>).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class ExternalDeveloperApiAttribute : Attribute;

public static class ExternalDeveloperApiEndpointExtensions
{
    public const string DocumentName = "external-v1";

    public static TBuilder IncludeInExternalDeveloperApi<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new ExternalDeveloperApiAttribute());
        return builder;
    }
}

internal sealed class ExternalDeveloperApiOpenApiTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        document.Info.Title = "EcuNexo Developer API — Integraciones de Empresa";
        document.Info.Version = "v1";
        document.Info.Description = """
            Especificación oficial **OpenAPI v1** para que cada empresa (tenant) construya su propia infraestructura cliente (tienda e-commerce headless, ERP corporativo, aplicación móvil, POS o automatizaciones) sobre **EcuNexo**.

            ---

            ### 1. Autenticación Machine-to-Machine (`X-Api-Key`)
            1. Ingrese a **EcuNexo Admin → Configuración → API y Desarrolladores** (`/organizacion/api`).
            2. Genere una **API Key** seleccionando únicamente los permisos (*scopes*) que su integración necesita.
            3. Envíe la llave en la cabecera `X-Api-Key` en cada petición HTTPS:

            ```http
            GET /api/v1/tenants/{tenantId}/catalog/items HTTP/1.1
            Host: api.ecunexo.com
            X-Api-Key: ecx_live_a1b2c3d4_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a
            Accept: application/json
            ```

            *(También se admite `Authorization: Bearer ecx_live_...` para clientes o SDKs que solo soportan esquema Bearer).*

            ---

            ### 2. Aislamiento Multi-Tenant, Módulos y Scopes
            Toda llamada con `X-Api-Key` pasa por 3 validaciones en el backend:
            1. **Aislamiento de Organización (`TenantId`)**: El `{tenantId}` de la URL debe coincidir con la organización propietaria de la API Key. Si intenta consultar otro tenant, recibirá `403 Forbidden` (`auth.tenant.mismatch`).
            2. **Módulos Contratados (`ModuleEntitlements`)**: La organización debe tener activo en su licencia el módulo asociado al endpoint (`catalog`, `inventory`, `warehousing`, `customers`, `orders`). Si no está contratado, recibirá `403 Forbidden` (`module.not_entitled`).
            3. **Alcance de la Llave (`Scopes`)**: La API Key debe poseer el permiso requerido por la operación (ej. `catalog.item.read`). Si no lo tiene, recibirá `403 Forbidden` (`auth.api_key.scope_denied`).

            ---

            ### 3. Códigos de Respuesta y Errores Estándar
            | Código HTTP | Código de Error (`code`) | Significado |
            | :--- | :--- | :--- |
            | `200 OK` / `201 Created` | — | Operación procesada exitosamente. |
            | `400 Bad Request` | `*.validation` | Parámetros o cuerpo JSON inválidos. |
            | `401 Unauthorized` | `auth.unauthorized` | Falta la cabecera `X-Api-Key`, el formato es inválido, o la llave expiró / fue revocada. |
            | `403 Forbidden` | `auth.tenant.mismatch` | El `{tenantId}` de la ruta no corresponde al tenant de la API Key. |
            | `403 Forbidden` | `module.not_entitled` | El módulo requerido no está incluido en el plan/licencia de la empresa. |
            | `403 Forbidden` | `auth.api_key.scope_denied` | La API Key es válida pero no tiene asignado el *scope* que exige este endpoint. |
            | `404 Not Found` | `*.not_found` | El recurso solicitado no existe dentro del tenant. |
            | `429 Too Many Requests` | `rate_limit.exceeded` | Se superó la cuota de peticiones por minuto asignada. |
            """;

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes = new Dictionary<string, IOpenApiSecurityScheme>
        {
            ["ApiKeyAuth"] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.ApiKey,
                Name = TenantApiKeyAuthenticationDefaults.HeaderName,
                In = ParameterLocation.Header,
                Description = "Credencial M2M generada en EcuNexo Admin (`X-Api-Key: ecx_live_<prefijo>_<secreto>`).",
            },
        };

        document.Tags = new HashSet<OpenApiTag>
        {
            new()
            {
                Name = "Catalog",
                Description = "Productos, matrices de variantes, atributos e imágenes del catálogo de la empresa (`catalog.item.read`, `catalog.item.create`, `catalog.item.update`, `catalog.item.delete`).",
            },
            new()
            {
                Name = "Pricing",
                Description = "Listas de precios, precios por producto, promociones y motor de resolución de precios (`catalog.pricing.read`, `catalog.pricing.create`, `catalog.pricing.update`).",
            },
            new()
            {
                Name = "Warehousing",
                Description = "Bodegas y centros de almacenamiento operativos de la organización (`warehousing.read`, `warehousing.warehouse.manage`).",
            },
            new()
            {
                Name = "Inventory",
                Description = "Saldos de stock por bodega, movimientos de kárdex y documentos de ingreso/egreso/transferencia (`inventory.stock.read`, `inventory.movement.read`, `inventory.documents.create`, `inventory.documents.approve`).",
            },
            new()
            {
                Name = "Customers",
                Description = "Directorio de clientes, búsqueda por RUC/Cédula (`by-tax-id`) y alta/actualización comercial (`customers.read`, `customers.manage`).",
            },
            new()
            {
                Name = "Ecommerce",
                Description = "Gestión de pedidos omnicanal, creación de órdenes y transición de estados de pago/despacho/entrega (`ecommerce.orders.read`, `ecommerce.orders.create`, `ecommerce.orders.manage`).",
            },
            new()
            {
                Name = "Storefront",
                Description = "Endpoints públicos de vitrina (anónimos con Rate Limiting) para construir tiendas online o catálogos públicos sin exponer credenciales privadas.",
            },
        };

        return Task.CompletedTask;
    }
}

internal sealed class ExternalDeveloperApiOperationTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        var metadata = context.Description.ActionDescriptor.EndpointMetadata;
        var allowsAnonymous = metadata.OfType<IAllowAnonymous>().Any();

        if (!allowsAnonymous)
        {
            operation.Security ??= [];
            operation.Security.Add(new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("ApiKeyAuth", context.Document)] = [],
            });

            operation.Responses ??= new OpenApiResponses();
            operation.Responses.TryAdd(
                "401",
                new OpenApiResponse
                {
                    Description = "No autenticado: falta cabecera `X-Api-Key` o la credencial fue revocada/expiró.",
                });
            operation.Responses.TryAdd(
                "403",
                new OpenApiResponse
                {
                    Description = "Acceso denegado: `auth.tenant.mismatch`, `module.not_entitled` o `auth.api_key.scope_denied`.",
                });
        }

        return Task.CompletedTask;
    }
}
