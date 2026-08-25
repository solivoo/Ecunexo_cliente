using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Tenancy;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Commands.BrandLogos;
using EcuNexo.Business.Tenancy.Queries.BrandLogos;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Api.Endpoints.V1.Tenancy;

public static class TenantBrandLogoEndpoints
{
    public static WebApplication MapTenantBrandLogoEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/brand-logos")
            .WithApiVersionSet(versionSet)
            .WithTags("Tenancy");

        group.MapGet("/", ListAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny("tenancy.tenants.read", "tenancy.tenant.read"));

        group.MapGet("/{logoId:guid}/file", GetFileAsync)
            .AllowAnonymous();

        group.MapPost("/", UploadAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny("tenancy.tenants.update", "tenancy.tenant.update"))
            .DisableAntiforgery();

        group.MapPut("/selection", SelectAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny("tenancy.tenants.update", "tenancy.tenant.update"));

        group.MapDelete("/{logoId:guid}", DeleteAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny("tenancy.tenants.update", "tenancy.tenant.update"));

        return app;
    }

    private static async Task<IResult> ListAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListTenantBrandLogosQuery, TenantBrandLogoCatalogResponse>(
                new ListTenantBrandLogosQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetFileAsync(
        Guid tenantId,
        Guid logoId,
        ISender sender,
        HttpContext http,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetTenantBrandLogoFileQuery, TenantBrandLogoFileResponse>(
                new GetTenantBrandLogoFileQuery(tenantId, logoId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        TenantBrandLogoFileResponse? file = result.Value;
        if (file is null)
        {
            return Results.NotFound();
        }

        http.Response.Headers.CacheControl = "public,max-age=86400";
        return Results.File(file.Bytes, file.ContentType);
    }

    private static async Task<IResult> UploadAsync(
        Guid tenantId,
        IFormFile file,
        ISender sender,
        CancellationToken ct)
    {
        if (file.Length == 0)
        {
            return Results.BadRequest("Selecciona un archivo de imagen.");
        }

        if (file.Length > TenantBrandLogo.MaxBytes)
        {
            return Results.BadRequest("El logo no puede superar 256 KB. Comprime la imagen e inténtalo de nuevo.");
        }

        await using var stream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct).ConfigureAwait(false);

        var result = await sender
            .SendAsync<UploadTenantBrandLogoCommand, UploadTenantBrandLogoResponse>(
                new UploadTenantBrandLogoCommand(
                    tenantId,
                    file.FileName,
                    file.ContentType ?? string.Empty,
                    ms.ToArray()),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        UploadTenantBrandLogoResponse? value = result.Value;
        if (value is null)
        {
            return Results.Problem("No se pudo registrar el logo.");
        }

        return Results.Created(
            $"/api/v1/tenants/{tenantId}/brand-logos/{value.LogoId}/file",
            value);
    }

    private static async Task<IResult> SelectAsync(
        Guid tenantId,
        SelectTenantBrandLogosRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SelectTenantBrandLogosCommand, SelectTenantBrandLogosResponse>(
                body.ToCommand(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteAsync(
        Guid tenantId,
        Guid logoId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeleteTenantBrandLogoCommand, DeleteTenantBrandLogoResponse>(
                new DeleteTenantBrandLogoCommand(tenantId, logoId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
