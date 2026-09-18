using EcuNexo.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using System.Security.Claims;

namespace EcuNexo.Business.UnitTests.Identity;

public sealed class HttpCallerContextTests
{
    [Fact(DisplayName = "En desarrollo (Development), petición no autenticada lee UserId y TenantId desde cabeceras X-EcuNexo-*")]
    public void Unauthenticated_InDevelopment_ParsesHeaders()
    {
        var expectedUserId = Guid.NewGuid();
        var expectedTenantId = Guid.NewGuid();

        var httpContextAccessor = Substitute.For<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-EcuNexo-User-Id"] = expectedUserId.ToString();
        httpContext.Request.Headers["X-EcuNexo-Tenant-Id"] = expectedTenantId.ToString();
        httpContextAccessor.HttpContext.Returns(httpContext);

        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(Environments.Development);

        var context = new HttpCallerContext(httpContextAccessor, env);

        context.UserId.Should().Be(expectedUserId);
        context.ExplicitTenantId.Should().Be(expectedTenantId);
    }

    [Fact(DisplayName = "En producción (Production), petición no autenticada IGNORA cabeceras X-EcuNexo-* y retorna null")]
    public void Unauthenticated_InProduction_IgnoresHeadersAndReturnsNull()
    {
        var injectedUserId = Guid.NewGuid();
        var injectedTenantId = Guid.NewGuid();

        var httpContextAccessor = Substitute.For<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-EcuNexo-User-Id"] = injectedUserId.ToString();
        httpContext.Request.Headers["X-EcuNexo-Tenant-Id"] = injectedTenantId.ToString();
        httpContextAccessor.HttpContext.Returns(httpContext);

        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(Environments.Production);

        var context = new HttpCallerContext(httpContextAccessor, env);

        context.UserId.Should().BeNull();
        context.ExplicitTenantId.Should().BeNull();
    }

    [Fact(DisplayName = "Usuario autenticado retorna identidad desde claims JWT tanto en producción como en desarrollo")]
    public void Authenticated_ReturnsIdentityFromClaims()
    {
        var authUserId = Guid.NewGuid();
        var authTenantId = Guid.NewGuid();

        var claims = new[]
        {
            new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, authUserId.ToString()),
            new Claim("tid", authTenantId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var httpContextAccessor = Substitute.For<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext { User = principal };
        httpContextAccessor.HttpContext.Returns(httpContext);

        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(Environments.Production);

        var context = new HttpCallerContext(httpContextAccessor, env);

        context.UserId.Should().Be(authUserId);
        context.ExplicitTenantId.Should().Be(authTenantId);
    }
}
