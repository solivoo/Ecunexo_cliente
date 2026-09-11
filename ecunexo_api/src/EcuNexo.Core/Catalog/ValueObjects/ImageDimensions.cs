using EcuNexo.Core.Common;

namespace EcuNexo.Core.Catalog.ValueObjects;

/// <summary>
/// Value Object que encapsula las dimensiones y proporciones de una imagen.
/// Invariante: Ancho y alto deben ser estrictamente mayores a cero.
/// </summary>
public readonly record struct ImageDimensions
{
    public int Width { get; init; }
    public int Height { get; init; }

    public decimal AspectRatio => Height == 0 ? 0 : Math.Round((decimal)Width / Height, 2);

    public bool IsSquare => Width == Height;

    public ImageDimensions(int width, int height)
    {
        if (width <= 0 || height <= 0)
        {
            throw new ArgumentException("Las dimensiones de imagen deben ser mayores a 0.");
        }

        Width = width;
        Height = height;
    }

    public static Result<ImageDimensions> Create(int width, int height)
    {
        if (width <= 0 || height <= 0)
        {
            return Result.Failure<ImageDimensions>(
                new Error("catalog.item.image.dimensions.invalid", "El ancho y el alto deben ser mayores a cero.", ErrorType.Validation));
        }

        return Result.Success(new ImageDimensions(width, height));
    }
}
