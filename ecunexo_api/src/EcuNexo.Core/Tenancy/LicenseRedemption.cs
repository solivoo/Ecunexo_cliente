using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>Registro local de canje de una licencia Ecunexo. El PK es el grant id emitido por platform.</summary>
public sealed class LicenseRedemption : AggregateRoot<Guid>
{
    private LicenseRedemption()
    {
    }

    public Guid SubscriptionAccountId { get; private set; }

    public DateTimeOffset RedeemedAtUtc { get; private set; }

    public static Result<LicenseRedemption> Create(
        Guid grantId,
        Guid subscriptionAccountId,
        DateTimeOffset redeemedAtUtc)
    {
        if (grantId == Guid.Empty || subscriptionAccountId == Guid.Empty)
        {
            return Result.Failure<LicenseRedemption>(
                new Error("redemption.ids.invalid", "Grant y titular son obligatorios.", ErrorType.Validation));
        }

        return new LicenseRedemption
        {
            Id = grantId,
            SubscriptionAccountId = subscriptionAccountId,
            RedeemedAtUtc = redeemedAtUtc,
        };
    }
}
