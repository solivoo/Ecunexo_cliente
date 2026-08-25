using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Authorization;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.EvaluateAuthorization;

public sealed class EvaluateAuthorizationHandler : IQueryHandler<EvaluateAuthorizationQuery, EvaluateAuthorizationResponse>
{
    private readonly IPermissionAccessGuard _guard;
    private readonly IUiAccessEvaluator _uiAccess;

    public EvaluateAuthorizationHandler(IPermissionAccessGuard guard, IUiAccessEvaluator uiAccess)
    {
        _guard = guard;
        _uiAccess = uiAccess;
    }

    public async Task<Result<EvaluateAuthorizationResponse>> Handle(
        EvaluateAuthorizationQuery query,
        CancellationToken ct)
    {
        var result = await _guard.RequireAsync(query.Permission, query.EvaluationContext, ct)
            .ConfigureAwait(false);
        if (result.IsSuccess)
        {
            var actions = _uiAccess.GetAllowedActions(query.Permission, granted: true);
            return Result.Success(new EvaluateAuthorizationResponse(true, null, actions));
        }

        return Result.Success(new EvaluateAuthorizationResponse(
            false,
            result.Error?.Message,
            _uiAccess.GetAllowedActions(query.Permission, granted: false)));
    }
}
