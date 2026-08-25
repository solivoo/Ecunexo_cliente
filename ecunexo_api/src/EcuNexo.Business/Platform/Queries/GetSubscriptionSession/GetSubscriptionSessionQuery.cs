using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Platform.Queries.GetSubscriptionSession;

public sealed record GetSubscriptionSessionQuery(Guid SubscriptionAccountId) : IQuery<SubscriptionSessionResponse>;
