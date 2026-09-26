using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateEcommerceBlockedContact;

public sealed class CreateEcommerceBlockedContactHandler
    : ICommandHandler<CreateEcommerceBlockedContactCommand, EcommerceBlockedContactDto>
{
    private readonly IEcommerceBlockedContactRepository _contacts;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateEcommerceBlockedContactHandler(
        IEcommerceBlockedContactRepository contacts,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _contacts = contacts;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<EcommerceBlockedContactDto>> Handle(
        CreateEcommerceBlockedContactCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<EcommerceBlockedContactDto>(
                new Error("ecommerce.blocked_contact.tenant_required", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (!Enum.TryParse<EcommerceBlockedContactKind>(command.Kind?.Trim(), ignoreCase: true, out var kind)
            || !Enum.IsDefined(kind))
        {
            return Result.Failure<EcommerceBlockedContactDto>(
                new Error("ecommerce.blocked_contact.kind_invalid", "El tipo de contacto debe ser Email o Phone.", ErrorType.Validation));
        }

        var created = EcommerceBlockedContact.Create(
            _idGenerator.NewId(),
            command.TenantId,
            kind,
            command.Value,
            command.Reason,
            command.CreatedBy);

        if (created.IsFailure)
        {
            return Result.Failure<EcommerceBlockedContactDto>(created.Error!);
        }

        var contact = created.Value!;
        var exists = await _contacts
            .ExistsAsync(command.TenantId, contact.Kind, contact.ValueNormalized, ct)
            .ConfigureAwait(false);
        if (exists)
        {
            return Result.Failure<EcommerceBlockedContactDto>(
                new Error(
                    "ecommerce.blocked_contact.already_exists",
                    "El contacto ya está bloqueado para esta tienda.",
                    ErrorType.Conflict));
        }

        await _contacts.AddAsync(contact, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(Map(contact));
    }

    private static EcommerceBlockedContactDto Map(EcommerceBlockedContact contact) =>
        new(
            contact.Id,
            contact.Kind.ToString(),
            contact.ValueNormalized,
            contact.Reason,
            contact.CreatedAt,
            contact.CreatedBy);
}
