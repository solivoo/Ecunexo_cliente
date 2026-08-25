using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Auth;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
namespace EcuNexo.Api.Endpoints.V1.Auth;

public static class AuthEndpoints
{
    public static WebApplication MapAuthEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/auth")
            .WithApiVersionSet(versionSet)
            .WithTags("Auth");

        group.MapPost("/login", LoginAsync);

        return app;
    }

    private static async Task<IResult> LoginAsync(LoginRequest body, ISender sender, CancellationToken ct)
    {
        var result = await sender
            .SendAsync<
                Business.Identity.Commands.Login.LoginCommand,
                Business.Identity.Commands.Login.LoginResponse>(
                new Business.Identity.Commands.Login.LoginCommand(
                    body.TenantId,
                    body.Email,
                    body.Password),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        
        return Results.Ok(new Contracts.V1.Auth.LoginResponse(
            value.AccessToken,
            value.ExpiresAt,
            value.UserId,
            value.TenantId,
            value.IsSubscriptionHolder));
    }
}
