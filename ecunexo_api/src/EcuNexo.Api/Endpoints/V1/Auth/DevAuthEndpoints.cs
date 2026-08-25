using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Auth;
using EcuNexo.Business.Abstractions;

namespace EcuNexo.Api.Endpoints.V1.Auth;

public static class DevAuthEndpoints
{
    public static WebApplication MapDevAuthEndpointsV1(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return app;
        }

        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/auth")
            .WithApiVersionSet(versionSet)
            .WithTags("Auth");

        group.MapPost("/dev-token", MintDevTokenAsync);

        return app;
    }

    private static IResult MintDevTokenAsync(DevTokenRequest body, IJwtAccessTokenFactory tokens)
    {
        if (body.UserId == Guid.Empty)
        {
            return Results.BadRequest(new { error = "«userId» no puede ser GUID vacío." });
        }

        if (body.TenantId is not { } tid || tid == Guid.Empty)
        {
            return Results.BadRequest(new { error = "«tenantId» es obligatorio en desarrollo." });
        }

        var jwt = tokens.Create(body.UserId, tid);
        return Results.Ok(new DevTokenResponse(jwt.Token, jwt.ExpiresAt));
    }
}
