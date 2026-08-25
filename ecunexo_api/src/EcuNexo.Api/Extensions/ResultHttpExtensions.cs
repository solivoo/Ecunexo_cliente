using EcuNexo.Core.Common;

namespace EcuNexo.Api.Extensions;

public static class ResultHttpExtensions
{
    public static IResult ToHttpResult(this Result result)
    {
        if (result.IsSuccess)
        {
            return Results.NoContent();
        }

        return ProblemFrom(result.Error!);
    }

    public static IResult ToHttpResult<T>(this Result<T> result)
    {
        if (result.IsSuccess)
        {
            return Results.Ok(result.Value);
        }

        return ProblemFrom(result.Error!);
    }

    private static IResult ProblemFrom(Error error)
    {
        var statusCode = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError
        };

        return Results.Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: TitleFor(error.Type),
            type: $"https://api.ecunexo/errors/{Uri.EscapeDataString(error.Code)}");
    }

    private static string TitleFor(ErrorType type) =>
        type switch
        {
            ErrorType.Validation => "Validación",
            ErrorType.NotFound => "No encontrado",
            ErrorType.Conflict => "Conflicto",
            ErrorType.Unauthorized => "No autorizado",
            ErrorType.Forbidden => "Prohibido",
            _ => "Error inesperado"
        };
}
