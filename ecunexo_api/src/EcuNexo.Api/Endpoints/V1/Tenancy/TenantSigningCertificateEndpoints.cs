using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Certificates;
using EcuNexo.Business.Tenancy.Certificates.Commands.UploadSigningCertificate;
using EcuNexo.Business.Tenancy.Certificates.Queries.GetSigningCertificateStatus;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Tenancy;

public static class TenantSigningCertificateEndpoints
{
    private const long MaxCertificateBytes = 5 * 1024 * 1024; // 5 MB

    public static WebApplication MapTenantSigningCertificateEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/signing-certificate")
            .WithApiVersionSet(versionSet)
            .WithTags("Tenancy - Digital Signature");

        group.MapGet("/status", GetStatusAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "tenancy.tenants.read",
                "tenancy.tenant.read",
                "facturacion.read",
                "facturacion.facturas.read",
                "facturacion.facturas.read.all",
                "facturacion.comprobantes.read",
                "facturacion.emisor.read"));

        group.MapPost("/", UploadAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "tenancy.tenants.update",
                "tenancy.tenant.update",
                "facturacion.emisor.manage",
                "facturacion.emisor.update"))
            .DisableAntiforgery();

        return app;
    }

    private static async Task<IResult> GetStatusAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetSigningCertificateStatusQuery, SigningCertificateStatusResponse>(
                new GetSigningCertificateStatusQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UploadAsync(
        Guid tenantId,
        IFormFile? file,
        [FromForm] string? password,
        ISender sender,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return Results.BadRequest(new { error = "certificate_file_required", message = "Selecciona un archivo de certificado digital (.p12 o .pfx)." });
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return Results.BadRequest(new { error = "certificate_password_required", message = "Ingresa la contraseña del certificado digital." });
        }

        if (file.Length > MaxCertificateBytes)
        {
            return Results.BadRequest(new { error = "file_too_large", message = "El certificado no puede superar 5 MB." });
        }

        await using var stream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct).ConfigureAwait(false);

        var result = await sender
            .SendAsync<UploadSigningCertificateCommand, SigningCertificateStatusResponse>(
                new UploadSigningCertificateCommand(
                    TenantId: tenantId,
                    P12Bytes: ms.ToArray(),
                    Password: password.Trim(),
                    OriginalFileName: file.FileName),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
