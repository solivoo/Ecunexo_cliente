using System.Security.Cryptography;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Commands;

public sealed class SendUserPasswordResetEmailHandler
    : ICommandHandler<SendUserPasswordResetEmailCommand, SendUserPasswordResetEmailResponse>
{
    private readonly IUserRepository _users;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailSender _emailSender;

    public SendUserPasswordResetEmailHandler(
        IUserRepository users,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IEmailSender emailSender)
    {
        _users = users;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _emailSender = emailSender;
    }

    public async Task<Result<SendUserPasswordResetEmailResponse>> Handle(
        SendUserPasswordResetEmailCommand command,
        CancellationToken ct)
    {
        var user = await _users.GetActiveByIdForUpdateAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SendUserPasswordResetEmailResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        if (user.IsDisabled)
        {
            return Result.Failure<SendUserPasswordResetEmailResponse>(
                new Error(
                    "user.disabled",
                    "No se puede restablecer la contraseña de un usuario deshabilitado.",
                    ErrorType.Conflict));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        var tenantLabel = tenant?.Name ?? "EcuNexo";

        var temporaryPassword = GenerateTemporaryPassword();
        var setPassword = user.SetPasswordHash(_passwordHasher.Hash(temporaryPassword));
        if (setPassword.IsFailure)
        {
            return Result.Failure<SendUserPasswordResetEmailResponse>(setPassword.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var body =
            $"Hola {user.Name},\n\n" +
            $"Un administrador de «{tenantLabel}» restableció tu contraseña de acceso a EcuNexo.\n\n" +
            $"Correo: {user.Email.Value}\n" +
            $"Contraseña temporal: {temporaryPassword}\n\n" +
            "Inicia sesión y cámbiala por una personal lo antes posible.\n\n" +
            "Si no esperabas este mensaje, contacta al administrador de tu empresa.\n";

        await _emailSender
            .SendAsync(
                new EmailMessage(
                    user.Email.Value,
                    user.Name,
                    $"EcuNexo — Contraseña temporal ({tenantLabel})",
                    body),
                ct)
            .ConfigureAwait(false);

        return Result.Success(
            new SendUserPasswordResetEmailResponse(user.Id, user.TenantId, user.Email.Value));
    }

    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        Span<char> chars = stackalloc char[12];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        }

        // Sufijo para cumplir reglas mínimas de complejidad habituales.
        return new string(chars) + "A1!";
    }
}
