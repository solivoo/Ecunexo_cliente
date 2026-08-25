using EcuNexo.Core.Common;

namespace EcuNexo.Core.Inventory;

internal static class InventoryQuantity
{
    public static Result<decimal> NormalizePositive(decimal quantity)
    {
        if (quantity <= 0)
        {
            return Result.Failure<decimal>(
                new Error(
                    "inventory.quantity.positive",
                    "La cantidad debe ser mayor que cero.",
                    ErrorType.Validation));
        }

        return Result.Success(decimal.Round(quantity, 4, MidpointRounding.AwayFromZero));
    }

    /// <summary>Permite cero (conteo físico vacío).</summary>
    public static Result<decimal> NormalizeNonNegative(decimal quantity)
    {
        if (quantity < 0)
        {
            return Result.Failure<decimal>(
                new Error(
                    "inventory.quantity.non_negative",
                    "La cantidad contada no puede ser negativa.",
                    ErrorType.Validation));
        }

        return Result.Success(decimal.Round(quantity, 4, MidpointRounding.AwayFromZero));
    }
}
