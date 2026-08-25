using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Commands.CancelSubscriptionCompany;

public sealed record CancelSubscriptionCompanyCommand(
    Guid SubscriptionAccountId,
    Guid TenantId) : ICommand<CancelSubscriptionCompanyResponse>;

public sealed record CancelSubscriptionCompanyResponse(Guid TenantId, TenantStatus Status);
