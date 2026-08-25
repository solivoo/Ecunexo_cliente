using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Business.Identity.Queries.GetTenantUser;
using EcuNexo.Business.Identity.Queries.ListTenantUsers;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class UserEndpoints
{
    public static WebApplication MapUserEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/users")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        group.MapPost("/", CreateUserAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.create"));
        group.MapGet("/", ListUsersAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.read"));
        group.MapGet("/{userId:guid}", GetUserAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.read"));
        group.MapPut("/{userId:guid}", UpdateUserAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.update"));
        group.MapPost("/{userId:guid}/disabled", SetUserDisabledAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.update"));
        group.MapPost("/{userId:guid}/password", SetUserPasswordAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.update"));
        group.MapPost("/{userId:guid}/password/reset-email", SendPasswordResetEmailAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.update"));
        group.MapDelete("/{userId:guid}", SoftDeleteUserAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.users.delete"));

        return app;
    }

    private static async Task<IResult> CreateUserAsync(
        Guid tenantId,
        CreateUserRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<CreateUserCommand, CreateUserResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/users/{value.UserId}",
            value);
    }

    private static async Task<IResult> ListUsersAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<ListTenantUsersQuery, IReadOnlyList<UserListItemResponse>>(
                new ListTenantUsersQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetUserAsync(Guid tenantId, Guid userId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<GetTenantUserQuery, GetTenantUserResponse>(
                new GetTenantUserQuery(tenantId, userId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateUserAsync(
        Guid tenantId,
        Guid userId,
        UpdateUserRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateUserCommand, UpdateUserResponse>(body.ToCommand(tenantId, userId), ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SetUserDisabledAsync(
        Guid tenantId,
        Guid userId,
        SetUserDisabledRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SetUserDisabledCommand, SetUserDisabledResponse>(
                new SetUserDisabledCommand(tenantId, userId, body.Disabled),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SetUserPasswordAsync(
        Guid tenantId,
        Guid userId,
        SetUserPasswordRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SetUserPasswordCommand, SetUserPasswordResponse>(
                new SetUserPasswordCommand(tenantId, userId, body.Password),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SendPasswordResetEmailAsync(
        Guid tenantId,
        Guid userId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SendUserPasswordResetEmailCommand, SendUserPasswordResetEmailResponse>(
                new SendUserPasswordResetEmailCommand(tenantId, userId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SoftDeleteUserAsync(
        Guid tenantId,
        Guid userId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SoftDeleteUserCommand, SoftDeleteUserResponse>(
                new SoftDeleteUserCommand(tenantId, userId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
