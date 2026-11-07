using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.ApiKeys;
using EcuNexo.Business.Identity.ApiKeys.Commands.CreateTenantApiKey;
using EcuNexo.Business.Identity.ApiKeys.Commands.RevokeTenantApiKey;
using EcuNexo.Business.Identity.ApiKeys.Queries.ListDeveloperApiScopes;
using EcuNexo.Business.Identity.ApiKeys.Queries.ListTenantApiKeys;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class TenantApiKeyEndpoints
{
    public static WebApplication MapTenantApiKeyEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/api-keys")
            .WithApiVersionSet(versionSet)
            .WithTags("Developer API Keys")
            .RequireAuthorization();

        group.MapGet("/scopes", ListScopesAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "platform.settings.read",
                    "tenancy.tenant.read",
                    "identity.roles.read"));

        group.MapGet("/", ListApiKeysAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "platform.settings.read",
                    "tenancy.tenant.read",
                    "identity.roles.read"));

        group.MapPost("/", CreateApiKeyAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "platform.settings.update",
                    "tenancy.tenant.update",
                    "identity.roles.manage"));

        group.MapDelete("/{apiKeyId:guid}", RevokeApiKeyAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "platform.settings.update",
                    "tenancy.tenant.update",
                    "identity.roles.manage"));

        return app;
    }

    private static async Task<IResult> ListScopesAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListDeveloperApiScopesQuery, IReadOnlyList<DeveloperApiScopeItemDto>>(
                new ListDeveloperApiScopesQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.IsSuccess ? Results.Ok(result.Value) : result.ToHttpResult();
    }

    private static async Task<IResult> ListApiKeysAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListTenantApiKeysQuery, IReadOnlyList<TenantApiKeyItemDto>>(
                new ListTenantApiKeysQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.IsSuccess ? Results.Ok(result.Value) : result.ToHttpResult();
    }

    private static async Task<IResult> CreateApiKeyAsync(
        Guid tenantId,
        CreateTenantApiKeyRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateTenantApiKeyCommand, CreatedTenantApiKeyDto>(
                new CreateTenantApiKeyCommand(
                    tenantId,
                    body.Name,
                    body.Scopes ?? [],
                    body.ExpiresAt),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var created = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{tenantId}/api-keys/{created.Id}",
            created);
    }

    private static async Task<IResult> RevokeApiKeyAsync(
        Guid tenantId,
        Guid apiKeyId,
        ITenantApiKeyRepository repository,
        IMemoryCache memoryCache,
        ISender sender,
        CancellationToken ct)
    {
        var existing = await repository.GetByIdAsync(tenantId, apiKeyId, ct).ConfigureAwait(false);
        var result = await sender
            .SendAsync<RevokeTenantApiKeyCommand, bool>(
                new RevokeTenantApiKeyCommand(tenantId, apiKeyId),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        if (existing is not null)
        {
            memoryCache.Remove(TenantApiKeyAuthenticationDefaults.GetCacheKey(existing.KeyPrefix));
        }

        return Results.NoContent();
    }
}
