namespace EcuNexo.Business.Identity;

/// <summary>
/// Hash y verificación de contraseñas (implementación en la Api, sin acoplar Business a ASP.NET Identity).
/// </summary>
public interface IPasswordHasher
{
    string Hash(string plainPassword);

    bool Verify(string plainPassword, string passwordHash);
}
