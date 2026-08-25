namespace EcuNexo.Business.Identity.Authorization;

public interface IUiAccessEvaluator
{
    IReadOnlyList<string> GetAllowedActions(string permissionCode, bool granted);
}
