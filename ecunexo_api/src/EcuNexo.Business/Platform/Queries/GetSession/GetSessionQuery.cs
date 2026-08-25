using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Platform.Queries.GetSession;

public sealed record GetSessionQuery(Guid TenantId, Guid UserId) : IQuery<SessionResponse>;
