using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Accounting;

/// <summary>
/// Representa un asiento contable en el Libro Diario bajo el principio de Partida Doble (NIIF / SCVS Ecuador).
/// Invariante estricta: Total Debe == Total Haber en todo asiento contabilizado.
/// </summary>
public sealed class JournalEntry : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int EntryNumberMaxLength = 50;
    public const int DescriptionMaxLength = 500;
    public const int SourceReferenceMaxLength = 100;

    private readonly List<JournalEntryLine> _lines = new();

    private JournalEntry()
    {
    }

    public Guid TenantId { get; private set; }
    public string EntryNumber { get; private set; } = string.Empty;
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public JournalEntrySource Source { get; private set; }
    public Guid? SourceId { get; private set; }
    public string? SourceReference { get; private set; }
    public JournalEntryStatus Status { get; private set; }

    public decimal TotalDebit { get; private set; }
    public decimal TotalCredit { get; private set; }
    public bool IsBalanced => Math.Abs(TotalDebit - TotalCredit) < 0.0001m;

    public IReadOnlyCollection<JournalEntryLine> Lines => _lines.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }

    public static Result<JournalEntry> Create(
        Guid id,
        Guid tenantId,
        string entryNumber,
        DateOnly date,
        string description,
        JournalEntrySource source = JournalEntrySource.Manual,
        Guid? sourceId = null,
        string? sourceReference = null,
        JournalEntryStatus status = JournalEntryStatus.Posted,
        IEnumerable<JournalEntryLine>? lines = null,
        Guid? createdBy = null,
        DateTimeOffset? createdAt = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.id_empty", "El identificador del asiento no puede estar vacío.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.tenant_empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(entryNumber))
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.entry_number_required", "El número de asiento es obligatorio.", ErrorType.Validation));
        }

        var trimmedNumber = entryNumber.Trim();
        if (trimmedNumber.Length > EntryNumberMaxLength)
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.entry_number_too_long", $"El número de asiento no puede exceder {EntryNumberMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.description_required", "La glosa o descripción del asiento contable es obligatoria.", ErrorType.Validation));
        }

        var trimmedDesc = description.Trim();
        if (trimmedDesc.Length > DescriptionMaxLength)
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.description_too_long", $"La descripción no puede exceder {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        var trimmedSourceRef = sourceReference?.Trim();
        if (trimmedSourceRef?.Length > SourceReferenceMaxLength)
        {
            return Result.Failure<JournalEntry>(
                new Error("accounting.journal_entry.source_reference_too_long", $"La referencia de origen no puede exceder {SourceReferenceMaxLength} caracteres.", ErrorType.Validation));
        }

        var entry = new JournalEntry
        {
            Id = id,
            TenantId = tenantId,
            EntryNumber = trimmedNumber,
            Date = date,
            Description = trimmedDesc,
            Source = source,
            SourceId = sourceId,
            SourceReference = trimmedSourceRef,
            Status = status,
            CreatedBy = createdBy,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow
        };

        if (lines != null)
        {
            foreach (var line in lines)
            {
                line.AttachToEntry(entry.Id);
                entry._lines.Add(line);
            }
        }

        entry.RecalculateTotals();

        if (status == JournalEntryStatus.Posted)
        {
            var validateBalance = entry.ValidatePostingInvariants();
            if (validateBalance.IsFailure)
            {
                return Result.Failure<JournalEntry>(validateBalance.Error!);
            }
        }

        return Result.Success(entry);
    }

    public Result AddLine(JournalEntryLine line)
    {
        if (Status != JournalEntryStatus.Draft)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.not_draft", "No se pueden agregar apuntes a un asiento que ya ha sido contabilizado o anulado.", ErrorType.Conflict));
        }

        line.AttachToEntry(Id);
        _lines.Add(line);
        RecalculateTotals();
        return Result.Success();
    }

    public Result RemoveLine(Guid lineId)
    {
        if (Status != JournalEntryStatus.Draft)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.not_draft", "No se pueden remover apuntes de un asiento que ya ha sido contabilizado o anulado.", ErrorType.Conflict));
        }

        var line = _lines.FirstOrDefault(l => l.Id == lineId);
        if (line == null)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.line_not_found", "La línea contable no fue encontrada.", ErrorType.NotFound));
        }

        _lines.Remove(line);
        RecalculateTotals();
        return Result.Success();
    }

    public Result Post(Guid? userId = null, DateTimeOffset? now = null)
    {
        if (Status == JournalEntryStatus.Posted)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.already_posted", "El asiento contable ya se encuentra contabilizado.", ErrorType.Conflict));
        }

        if (Status == JournalEntryStatus.Cancelled)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.cannot_post_cancelled", "No se puede contabilizar un asiento contable que fue anulado.", ErrorType.Conflict));
        }

        var balanceCheck = ValidatePostingInvariants();
        if (balanceCheck.IsFailure)
        {
            return balanceCheck;
        }

        Status = JournalEntryStatus.Posted;
        UpdatedBy = userId;
        UpdatedAt = now ?? DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result Cancel(string reason, Guid? userId = null, DateTimeOffset? now = null)
    {
        if (Status == JournalEntryStatus.Cancelled)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.already_cancelled", "El asiento contable ya ha sido anulado previamente.", ErrorType.Conflict));
        }

        Status = JournalEntryStatus.Cancelled;
        Description = $"{Description} [ANULADO: {reason.Trim()}]";
        UpdatedBy = userId;
        UpdatedAt = now ?? DateTimeOffset.UtcNow;
        return Result.Success();
    }

    private void RecalculateTotals()
    {
        TotalDebit = Math.Round(_lines.Sum(l => l.Debit), 2, MidpointRounding.AwayFromZero);
        TotalCredit = Math.Round(_lines.Sum(l => l.Credit), 2, MidpointRounding.AwayFromZero);
    }

    private Result ValidatePostingInvariants()
    {
        if (_lines.Count < 2)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.minimum_lines", "Un asiento contable debe contener al menos 2 apuntes (partida doble).", ErrorType.Validation));
        }

        if (!IsBalanced)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.unbalanced", $"El asiento contable está descuadrado: Total Debe (${TotalDebit:F2}) no coincide con Total Haber (${TotalCredit:F2}).", ErrorType.Validation));
        }

        if (TotalDebit <= 0)
        {
            return Result.Failure(
                new Error("accounting.journal_entry.zero_totals", "El asiento contable debe tener importes mayores a cero.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
