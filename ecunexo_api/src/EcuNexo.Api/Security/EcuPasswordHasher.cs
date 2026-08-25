using EcuNexo.Business.Identity;
using Microsoft.AspNetCore.Identity;

namespace EcuNexo.Api.Security;

/// <summary>PBKDF2 vía <see cref="PasswordHasher{TUser}"/> de ASP.NET Core Identity.</summary>
internal sealed class PasswordMarker;

public sealed class EcuPasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<PasswordMarker> _hasher = new();

    public string Hash(string plainPassword)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(plainPassword);
        return _hasher.HashPassword(new PasswordMarker(), plainPassword);
    }

    public bool Verify(string plainPassword, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            return false;
        }

        var result = _hasher.VerifyHashedPassword(new PasswordMarker(), passwordHash, plainPassword);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
