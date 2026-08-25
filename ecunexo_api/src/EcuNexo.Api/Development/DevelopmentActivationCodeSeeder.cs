using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Tenancy;
using EcuNexo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using EcuNexo.Api.Configuration;

namespace EcuNexo.Api.Development;

/// <summary>
/// En Development, asegura un código de activación de prueba si la tabla está vacía.
/// Texto en claro documentado: <c>DEV-ECUNEXO-ACTIVATION</c> (debe coincidir con el pepper de configuración al hashear).
/// </summary>
internal static class DevelopmentActivationCodeSeeder
{
    public const string DevActivationCodePlaintext = "DEV-ECUNEXO-ACTIVATION";

    public static async Task EnsureAsync(WebApplication app, CancellationToken cancellationToken)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EcuNexoDbContext>();
        if (await db.ActivationCodes.AsNoTracking().AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return;
        }

        var pepper = scope.ServiceProvider.GetRequiredService<IOptions<ActivationCodeOptions>>().Value.Pepper;
        if (string.IsNullOrWhiteSpace(pepper))
        {
            return;
        }

        var idGenerator = scope.ServiceProvider.GetRequiredService<IIdGenerator>();
        var hash = ActivationCodeHasher.ComputeHash(
            ActivationCodeHasher.Normalize(DevActivationCodePlaintext),
            pepper);

        var utcNow = DateTimeOffset.UtcNow;
        var created = ActivationCode.Create(
            idGenerator.NewId(),
            hash,
            "Activación desarrollo",
            maxTenants: 10,
            maxUsers: 100,
            maxWarehouses: 50,
            TenantModuleCodes.All,
            expiresAtUtc: utcNow.AddYears(50),
            utcNow);

        if (created.IsFailure)
        {
            throw new InvalidOperationException($"{created.Error!.Code}: {created.Error.Message}");
        }

        db.ActivationCodes.Add(created.Value!);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
