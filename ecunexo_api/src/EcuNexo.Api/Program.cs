using Asp.Versioning;
using EcuNexo.Api.Configuration;
using EcuNexo.Api.Development;
using EcuNexo.Api.Endpoints.V1.Auth;
using EcuNexo.Api.Endpoints.V1.Catalog;
using EcuNexo.Api.Endpoints.V1.Customers;
using EcuNexo.Api.Endpoints.V1.Ecommerce;
using EcuNexo.Api.Endpoints.V1.Identity;
using EcuNexo.Api.Endpoints.V1.Inventory;
using EcuNexo.Api.Endpoints.V1.Platform;
using EcuNexo.Api.Endpoints.V1.Repairs;
using EcuNexo.Api.Endpoints.V1.Warehousing;
using EcuNexo.Api.Endpoints.V1.Subscription;
using EcuNexo.Api.Endpoints.V1.Tenancy;
using EcuNexo.Api.Middleware;
using EcuNexo.Api.Security;
using EcuNexo.Api.Tenancy;
using EcuNexo.Business;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Data;
using EcuNexo.Api.Email;
using EcuNexo.Api.Licensing;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = new UrlSegmentApiVersionReader();
    })
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });

builder.Services.AddOpenApi(options => options.AddDocumentTransformer<BearerSecuritySchemeTransformer>());

builder.Services.AddEcuNexoJwt(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICallerContext, HttpCallerContext>();

builder.Services.Configure<ActivationCodeOptions>(
    builder.Configuration.GetSection(ActivationCodeOptions.SectionName));
builder.Services.Configure<LicenseValidationOptions>(
    builder.Configuration.GetSection(LicenseValidationOptions.SectionName));
builder.Services.Configure<InventoryEgressOptions>(
    builder.Configuration.GetSection(InventoryEgressOptions.SectionName));
builder.Services.AddScoped<IActivationCodePepperProvider, ActivationCodePepperProvider>();
builder.Services.AddScoped<ILicenseValidationPepperProvider, LicenseValidationPepperProvider>();
builder.Services.AddScoped<ILicenseArtifactVerifier, LicenseArtifactVerifier>();
builder.Services.AddHttpClient<ILicenseOnlineValidator, LicenseOnlineValidator>();

builder.Services.AddSingleton<IPasswordHasher, EcuPasswordHasher>();
builder.Services.AddSingleton<IJwtAccessTokenFactory, JwtAccessTokenFactory>();
builder.Services.AddSingleton<IEmailSender, LoggingEmailSender>();

builder.Services.AddBusiness(builder.Configuration);
builder.Services.AddData(connectionString);

var corsOrigins = ParseCorsOrigins(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "EcuNexoSpa",
        policy =>
        {
            if (corsOrigins.Length > 0)
            {
                policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod();
                return;
            }

            policy
                .SetIsOriginAllowed(static origin =>
                {
                    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                    {
                        return false;
                    }

                    if (uri.Scheme is not "http" and not "https")
                    {
                        return false;
                    }

                    return uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                        || uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
                })
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

var app = builder.Build();

app.UseCors("EcuNexoSpa");
app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<TenantResolutionMiddleware>();

app.MapOpenApi();
app.MapScalarApiReference();

app.MapGet("/", () => Results.Ok(new { service = "EcuNexo", status = "ok" }));

app.MapTenantEndpointsV1();
app.MapTenantBrandLogoEndpointsV1();
app.MapSubscriptionEndpointsV1();
app.MapOnboardingEndpointsV1();
app.MapAuthEndpointsV1();
app.MapDevAuthEndpointsV1();
app.MapSessionEndpointsV1();
app.MapTenantMenuEndpointsV1();
app.MapMenuItemEndpointsV1();
app.MapSettingsEndpointsV1();
app.MapAuthorizationEndpointsV1();
app.MapUserEndpointsV1();
app.MapRoleEndpointsV1();
app.MapDepartmentEndpointsV1();
app.MapPermissionEndpointsV1();
app.MapCatalogEndpointsV1();
app.MapWarehouseEndpointsV1();
app.MapInventoryEndpointsV1();
app.MapCustomerEndpointsV1();
app.MapCustomerTypeEndpointsV1();
app.MapRepairEndpointsV1();
app.MapEcommerceOrderEndpointsV1();

var migrateOnStartup = app.Configuration.GetValue(
    "Database:MigrateOnStartup",
    defaultValue: app.Environment.IsDevelopment());
if (migrateOnStartup)
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<EcuNexoDbContext>();
    await db.Database.MigrateAsync(CancellationToken.None).ConfigureAwait(false);
}

await DevelopmentActivationCodeSeeder.EnsureAsync(app, CancellationToken.None).ConfigureAwait(false);
await MenuCatalogSeeder.EnsureAsync(app, CancellationToken.None).ConfigureAwait(false);
await PlatformSettingsSeeder.EnsureAsync(app, CancellationToken.None).ConfigureAwait(false);

await app.RunAsync().ConfigureAwait(false);

static string[] ParseCorsOrigins(IConfiguration configuration)
{
    var fromArray = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
    if (fromArray is { Length: > 0 })
    {
        return fromArray
            .Select(static o => o.Trim())
            .Where(static o => o.Length > 0)
            .ToArray();
    }

    var csv = configuration["Cors:AllowedOrigins"];
    if (string.IsNullOrWhiteSpace(csv))
    {
        return [];
    }

    return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
