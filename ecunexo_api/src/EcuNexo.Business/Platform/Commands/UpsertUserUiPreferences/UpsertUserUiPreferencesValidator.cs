using FluentValidation;

namespace EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;

public sealed class UpsertUserUiPreferencesValidator : AbstractValidator<UpsertUserUiPreferencesCommand>
{
    private static readonly int[] AllowedRecords = [10, 20, 50, 100];
    private static readonly string[] AllowedPalettes = ["default", "modern", "enterprise"];
    private static readonly string[] AllowedDensities = ["sm", "md", "lg"];
    private static readonly string[] AllowedLookbacks = ["1m", "3m", "6m", "1y"];

    public UpsertUserUiPreferencesValidator()
    {
        RuleFor(c => c.ActorId).NotEmpty();
        RuleFor(c => c.MaxRecords)
            .Must(v => AllowedRecords.Contains(v))
            .WithMessage("Los registros por página deben ser 10, 20, 50 o 100.");
        RuleFor(c => c.Palette)
            .Must(v => AllowedPalettes.Contains(v))
            .WithMessage("El tema debe ser default, modern o enterprise.");
        RuleFor(c => c.Density)
            .Must(v => AllowedDensities.Contains(v))
            .WithMessage("El tamaño debe ser sm, md o lg.");
        RuleFor(c => c.DefaultLookback)
            .Must(v => AllowedLookbacks.Contains(v))
            .WithMessage("La ventana de listados debe ser 1 mes, 3 meses, 6 meses o 1 año.");
    }
}
