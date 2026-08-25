using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Tenancy;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Commands;
using EcuNexo.Business.Tenancy.Commands.ActivateLicense;
using EcuNexo.Business.Tenancy.Queries.GetOnboardingStatus;

namespace EcuNexo.Api.Endpoints.V1.Tenancy;

public static class OnboardingEndpoints
{
    public static WebApplication MapOnboardingEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/onboarding")
            .WithApiVersionSet(versionSet)
            .WithTags("Onboarding");

        group.MapGet("/status", GetOnboardingStatusAsync);
        group.MapPost("/tenant-with-activation", OnboardTenantWithActivationAsync);
        group.MapPost("/activate-license", ActivateLicenseAsync);

        return app;
    }

    private static async Task<IResult> GetOnboardingStatusAsync(ISender sender, CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetOnboardingStatusQuery, OnboardingStatusResponse>(
                new GetOnboardingStatusQuery(),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ActivateLicenseAsync(
        ActivateLicenseRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ActivateLicenseCommand, ActivateLicenseResponse>(body.ToCommand(), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> OnboardTenantWithActivationAsync(
        OnboardTenantWithActivationRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<OnboardTenantWithActivationCommand, OnboardTenantWithActivationResponse>(body.ToCommand(), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}",
            value);
    }
}
