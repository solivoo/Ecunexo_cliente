using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.CreateJournalEntry;

public sealed record CreateJournalEntryLineInput(
    Guid AccountId,
    decimal Debit,
    decimal Credit,
    string? Description = null);

public sealed record CreateJournalEntryCommand(
    Guid TenantId,
    DateOnly Date,
    string Description,
    IReadOnlyList<CreateJournalEntryLineInput> Lines,
    bool AutoPost = true,
    Guid? UserId = null) : ICommand<JournalEntryResponse>;

public sealed class CreateJournalEntryHandler : ICommandHandler<CreateJournalEntryCommand, JournalEntryResponse>
{
    private readonly IJournalEntryRepository _journalEntries;
    private readonly IAccountRepository _accounts;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateJournalEntryHandler(
        IJournalEntryRepository journalEntries,
        IAccountRepository accounts,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _journalEntries = journalEntries;
        _accounts = accounts;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<JournalEntryResponse>> Handle(
        CreateJournalEntryCommand command,
        CancellationToken ct)
    {
        if (command.Lines == null || command.Lines.Count < 2)
        {
            return Result.Failure<JournalEntryResponse>(
                new Error("journal_entry.insufficient_lines", "Un asiento contable debe tener al menos dos apuntes (partida doble).", ErrorType.Validation));
        }

        var allAccounts = await _accounts.ListAsync(
            command.TenantId,
            type: null,
            allowsMovementOnly: null,
            activeOnly: null,
            search: null,
            ct: ct).ConfigureAwait(false);

        var accountsMap = allAccounts.ToDictionary(a => a.Id, a => a);

        foreach (var lineInput in command.Lines)
        {
            if (!accountsMap.TryGetValue(lineInput.AccountId, out var acc))
            {
                return Result.Failure<JournalEntryResponse>(
                    new Error("journal_entry.account_not_found", $"La cuenta contable {lineInput.AccountId} no existe o no pertenece a la empresa.", ErrorType.NotFound));
            }

            if (!acc.AllowsMovement)
            {
                return Result.Failure<JournalEntryResponse>(
                    new Error("journal_entry.account_no_movement", $"La cuenta contable {acc.Code} - {acc.Name} es de mayor y no permite movimientos directos.", ErrorType.Validation));
            }

            if (!acc.IsActive)
            {
                return Result.Failure<JournalEntryResponse>(
                    new Error("journal_entry.account_inactive", $"La cuenta contable {acc.Code} - {acc.Name} se encuentra inactiva.", ErrorType.Validation));
            }
        }

        var entryNumber = await _journalEntries.GetNextEntryNumberAsync(command.TenantId, command.Date.Year, ct).ConfigureAwait(false);

        var domainLines = new List<JournalEntryLine>();
        foreach (var lineInput in command.Lines)
        {
            var acc = accountsMap[lineInput.AccountId];
            var lineResult = JournalEntryLine.Create(
                id: _idGenerator.NewId(),
                accountId: acc.Id,
                accountCode: acc.Code,
                accountName: acc.Name,
                debit: lineInput.Debit,
                credit: lineInput.Credit,
                reference: lineInput.Description);

            if (lineResult.IsFailure)
            {
                return Result.Failure<JournalEntryResponse>(lineResult.Error!);
            }

            domainLines.Add(lineResult.Value!);
        }

        var initialStatus = command.AutoPost ? JournalEntryStatus.Posted : JournalEntryStatus.Draft;

        var entryResult = JournalEntry.Create(
            id: _idGenerator.NewId(),
            tenantId: command.TenantId,
            entryNumber: entryNumber,
            date: command.Date,
            description: command.Description,
            source: JournalEntrySource.Manual,
            sourceId: null,
            sourceReference: null,
            status: initialStatus,
            lines: domainLines,
            createdBy: command.UserId);

        if (entryResult.IsFailure)
        {
            return Result.Failure<JournalEntryResponse>(entryResult.Error!);
        }

        var entry = entryResult.Value!;

        await _journalEntries.AddAsync(entry, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(JournalEntryResponse.FromDomain(entry));
    }
}
