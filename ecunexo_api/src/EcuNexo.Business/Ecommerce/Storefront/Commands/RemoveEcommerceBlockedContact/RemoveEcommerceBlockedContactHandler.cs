using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.RemoveEcommerceBlockedContact;

public sealed class RemoveEcommerceBlockedContactHandler
    : ICommandHandler<RemoveEcommerceBlockedContactCommand, bool>
{
    private readonly IEcommerceBlockedContactRepository _contacts;
    private readonly IUnitOfWork _unitOfWork;

    public RemoveEcommerceBlockedContactHandler(
        IEcommerceBlockedContactRepository contacts,
        IUnitOfWork unitOfWork)
    {
        _contacts = contacts;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(
        RemoveEcommerceBlockedContactCommand command,
        CancellationToken ct)
    {
        if (command.ContactId == Guid.Empty)
        {
            return Result.Failure<bool>(
                new Error("ecommerce.blocked_contact.id_empty", "El id del contacto bloqueado es obligatorio.", ErrorType.Validation));
        }

        var contact = await _contacts
            .GetByIdAsync(command.TenantId, command.ContactId, ct)
            .ConfigureAwait(false);
        if (contact is null)
        {
            return Result.Failure<bool>(
                new Error("ecommerce.blocked_contact.not_found", "El contacto bloqueado no existe.", ErrorType.NotFound));
        }

        _contacts.Remove(contact);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(true);
    }
}
