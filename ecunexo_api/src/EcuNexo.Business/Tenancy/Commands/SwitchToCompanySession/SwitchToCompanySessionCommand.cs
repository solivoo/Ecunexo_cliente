using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.SwitchToCompanySession;

public sealed record SwitchToCompanySessionCommand(
    Guid SubscriptionAccountId,
    Guid TenantId) : ICommand<SwitchToCompanySessionResponse>;

public sealed record SwitchToCompanySessionResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    Guid UserId,
    Guid TenantId,
    bool IsSubscriptionHolder);
