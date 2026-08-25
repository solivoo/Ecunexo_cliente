using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.GetPermissionById;

public sealed record GetPermissionByIdQuery(Guid PermissionId) : IQuery<PermissionDetailResponse>;
