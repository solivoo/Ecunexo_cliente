using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands.Login;

public sealed record LoginCommand(Guid? TenantId, string Email, string Password) : ICommand<LoginResponse>;
