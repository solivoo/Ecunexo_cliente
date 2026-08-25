namespace EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;

public sealed record ProvisionSubscriptionCompanyResponse(Guid TenantId, Guid UserId, Guid RoleId);
