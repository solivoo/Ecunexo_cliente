using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSession;

namespace EcuNexo.Business.Tenancy.Commands.SyncTenantLicense;

public sealed record SyncTenantLicenseCommand(Guid TenantId, Guid UserId)
    : ICommand<SessionResponse>;
