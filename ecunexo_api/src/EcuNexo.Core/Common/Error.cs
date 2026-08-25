namespace EcuNexo.Core.Common;

public enum ErrorType
{
    Validation, // Errores de validación, por ejemplo, un campo requerido
    NotFound, // No existe el recurso
    Conflict, // Ya existe el recurso, por ejemplo, un producto con el mismo SKU
    Unauthorized, // No autorizado, por ejemplo, no tienes permisos para acceder a un recurso
    Forbidden, // No tienes permisos, por ejemplo, no tienes permisos para acceder a un recurso
    Unexpected // Error inesperado, por ejemplo, un error de sistema
}

// Constructor Primario en C#
// Objeto recor publico q no puede ser heredado llamado Error que tiene 3 propiedades publicas Code, Message y Type
// Es similar a:

// public class Error 
// {
//     public string Code { get; }
//     public string Message { get; }

//     // ¡Mucho código solo para decir lo mismo!
//     public Error(string code, string message) 
//     {
//         Code = code;
//         Message = message;
//     }
// }


public sealed record Error(string Code, string Message, ErrorType Type)
{
    // al instaciar el record podemos usar "return Error.None";
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Unexpected);
};

