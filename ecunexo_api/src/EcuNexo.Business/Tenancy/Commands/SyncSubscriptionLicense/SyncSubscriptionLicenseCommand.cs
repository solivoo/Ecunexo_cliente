using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSubscriptionSession;

namespace EcuNexo.Business.Tenancy.Commands.SyncSubscriptionLicense;

public sealed record SyncSubscriptionLicenseCommand(Guid SubscriptionAccountId)
    : ICommand<SubscriptionSessionResponse>;
