using EcuNexo.Core.Common;

namespace EcuNexo.Core.Accounting;

/// <summary>
/// Representa un apunte o línea individual (Debe o Haber) dentro de un asiento contable.
/// </summary>
public sealed class JournalEntryLine : Entity<Guid>
{
    public const int ReferenceMaxLength = 250;

    private JournalEntryLine()
    {
    }

    public Guid JournalEntryId { get; private set; }
    public Guid AccountId { get; private set; }
    public string AccountCode { get; private set; } = string.Empty;
    public string AccountName { get; private set; } = string.Empty;
    public decimal Debit { get; private set; }
    public decimal Credit { get; private set; }
    public string? Reference { get; private set; }

    public static Result<JournalEntryLine> Create(
        Guid id,
        Guid accountId,
        string accountCode,
        string accountName,
        decimal debit,
        decimal credit,
        string? reference = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.id_empty", "El identificador de la línea no puede estar vacío.", ErrorType.Validation));
        }

        if (accountId == Guid.Empty)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.account_id_required", "El id de la cuenta contable es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(accountCode))
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.account_code_required", "El código de la cuenta contable es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(accountName))
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.account_name_required", "El nombre de la cuenta contable es obligatorio.", ErrorType.Validation));
        }

        if (debit < 0 || credit < 0)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.negative_amounts", "Los importes de Debe y Haber no pueden ser negativos.", ErrorType.Validation));
        }

        if (debit == 0 && credit == 0)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.zero_amounts", "La línea contable debe contener un valor mayor a cero en Debe o en Haber.", ErrorType.Validation));
        }

        if (debit > 0 && credit > 0)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.both_amounts", "Una línea contable no puede tener simultáneamente importes en Debe y Haber.", ErrorType.Validation));
        }

        var trimmedRef = reference?.Trim();
        if (trimmedRef?.Length > ReferenceMaxLength)
        {
            return Result.Failure<JournalEntryLine>(
                new Error("accounting.journal_entry_line.reference_too_long", $"La referencia no puede exceder {ReferenceMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(new JournalEntryLine
        {
            Id = id,
            AccountId = accountId,
            AccountCode = accountCode.Trim(),
            AccountName = accountName.Trim(),
            Debit = Math.Round(debit, 2, MidpointRounding.AwayFromZero),
            Credit = Math.Round(credit, 2, MidpointRounding.AwayFromZero),
            Reference = trimmedRef
        });
    }

    internal void AttachToEntry(Guid journalEntryId)
    {
        JournalEntryId = journalEntryId;
    }
}
