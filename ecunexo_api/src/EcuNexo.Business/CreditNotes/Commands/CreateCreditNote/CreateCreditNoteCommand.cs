using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.CreditNotes;
using EcuNexo.Core.Purchases.Services;

namespace EcuNexo.Business.CreditNotes.Commands.CreateCreditNote;

public sealed record CreateCreditNoteItemInput(
    string ItemCode,
    string? AdditionalCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount = 0m,
    string VatPercentageCode = "4",
    decimal VatRate = 15.00m,
    Guid? WarehouseId = null);

public sealed record CreditNoteAdditionalFieldInput(
    string Name,
    string Value);

public sealed record CreateCreditNoteCommand(
    Guid TenantId,
    string Establishment,
    string EmissionPoint,
    string? Sequential,
    DateOnly IssueDate,
    CreditNoteReasonType ReasonType,
    string Reason,
    string ModifiedDocumentType,
    string ModifiedDocumentNumber,
    DateOnly ModifiedDocumentIssueDate,
    string BuyerIdentificationType,
    string BuyerIdentification,
    string BuyerName,
    string BuyerAddress,
    string? BuyerEmail = null,
    string? ModifiedDocumentAuthorizationNumber = null,
    Guid? ModifiedDocumentId = null,
    string Environment = "1",
    IReadOnlyList<CreateCreditNoteItemInput>? Items = null,
    IReadOnlyList<CreditNoteAdditionalFieldInput>? AdditionalFields = null,
    Guid? UserId = null) : ICommand<CreateCreditNoteResponse>;

public sealed record CreateCreditNoteResponse(
    Guid CreditNoteId,
    string DocumentNumber,
    string AccessKey,
    CreditNoteStatus Status,
    decimal SubtotalWithoutTaxes,
    decimal VatAmount,
    decimal ModificationValue,
    string? XmlContent);

public sealed class CreateCreditNoteHandler : ICommandHandler<CreateCreditNoteCommand, CreateCreditNoteResponse>
{
    private readonly ICreditNoteRepository _repository;
    private readonly ITenantRepository _tenants;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCreditNoteHandler(
        ICreditNoteRepository repository,
        ITenantRepository tenants,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _tenants = tenants;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateCreditNoteResponse>> Handle(CreateCreditNoteCommand command, CancellationToken ct = default)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<CreateCreditNoteResponse>(new Error("credit_note.tenant_id.empty", "El tenantId es obligatorio.", ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<CreateCreditNoteResponse>(new Error("credit_note.tenant.not_found", "La empresa emisor no existe.", ErrorType.NotFound));
        }

        if (command.Items == null || command.Items.Count == 0)
        {
            return Result.Failure<CreateCreditNoteResponse>(new Error("credit_note.items.empty", "La Nota de Crédito debe contener al menos un ítem.", ErrorType.Validation));
        }

        var estab = (command.Establishment?.Trim() ?? "001").PadLeft(3, '0');
        var pto = (command.EmissionPoint?.Trim() ?? "001").PadLeft(3, '0');
        var env = command.Environment == "2" ? "2" : "1";

        string seq;
        if (string.IsNullOrWhiteSpace(command.Sequential))
        {
            seq = await _repository.AllocateNextSequentialAsync(command.TenantId, estab, pto, env, ct).ConfigureAwait(false);
        }
        else
        {
            seq = command.Sequential.Trim().PadLeft(9, '0');
            var existing = await _repository.GetByDocumentNumberAsync(command.TenantId, estab, pto, seq, ct).ConfigureAwait(false);
            if (existing != null)
            {
                return Result.Failure<CreateCreditNoteResponse>(new Error("credit_note.sequential_duplicate", $"Ya existe una Nota de Crédito con el número {estab}-{pto}-{seq}.", ErrorType.Conflict));
            }
        }

        var creditNoteId = _idGenerator.NewId();
        var ruc = string.IsNullOrWhiteSpace(tenant.TaxId) ? "9999999999999" : tenant.TaxId;

        // 1. Clave de Acceso de 49 dígitos Módulo 11
        var accessKey = SriAccessKeyGenerator.Generate(
            command.IssueDate,
            "04",
            ruc,
            env,
            estab,
            pto,
            seq
        );

        // 2. Creación del Agregado Raíz
        var creditNoteResult = CreditNote.Create(
            id: creditNoteId,
            tenantId: command.TenantId,
            establishment: estab,
            emissionPoint: pto,
            sequential: seq,
            issueDate: command.IssueDate,
            reasonType: command.ReasonType,
            reason: command.Reason,
            modifiedDocumentType: command.ModifiedDocumentType,
            modifiedDocumentNumber: command.ModifiedDocumentNumber,
            modifiedDocumentIssueDate: command.ModifiedDocumentIssueDate,
            buyerIdentificationType: command.BuyerIdentificationType,
            buyerIdentification: command.BuyerIdentification,
            buyerName: command.BuyerName,
            buyerAddress: command.BuyerAddress,
            buyerEmail: command.BuyerEmail,
            modifiedDocumentAuthorizationNumber: command.ModifiedDocumentAuthorizationNumber,
            modifiedDocumentId: command.ModifiedDocumentId,
            environment: env,
            accessKey: accessKey
        );

        if (creditNoteResult.IsFailure)
        {
            return Result.Failure<CreateCreditNoteResponse>(creditNoteResult.Error!);
        }

        var creditNote = creditNoteResult.Value!;

        // 3. Adición de Ítems
        int lineNumber = 1;
        foreach (var itemInput in command.Items)
        {
            var itemResult = CreditNoteItem.Create(
                id: _idGenerator.NewId(),
                creditNoteId: creditNoteId,
                lineNumber: lineNumber++,
                itemCode: itemInput.ItemCode,
                additionalCode: itemInput.AdditionalCode,
                description: itemInput.Description,
                quantity: itemInput.Quantity,
                unitPrice: itemInput.UnitPrice,
                discount: itemInput.Discount,
                vatPercentageCode: itemInput.VatPercentageCode,
                vatRate: itemInput.VatRate,
                warehouseId: itemInput.WarehouseId
            );

            if (itemResult.IsFailure)
            {
                return Result.Failure<CreateCreditNoteResponse>(itemResult.Error!);
            }

            creditNote.AddItem(itemResult.Value!);
        }

        // 4. Campos Adicionales
        if (command.AdditionalFields != null)
        {
            foreach (var field in command.AdditionalFields)
            {
                creditNote.AddAdditionalField(field.Name, field.Value);
            }
        }

        // 5. Persistencia
        await _repository.AddAsync(creditNote, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var response = new CreateCreditNoteResponse(
            CreditNoteId: creditNote.Id,
            DocumentNumber: creditNote.DocumentNumber,
            AccessKey: creditNote.AccessKey,
            Status: creditNote.Status,
            SubtotalWithoutTaxes: creditNote.SubtotalWithoutTaxes,
            VatAmount: creditNote.VatAmount,
            ModificationValue: creditNote.ModificationValue,
            XmlContent: creditNote.XmlContent
        );

        return Result.Success(response);
    }
}
