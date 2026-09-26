using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.ListEcommerceBlockedContacts;

public sealed class ListEcommerceBlockedContactsHandler
    : IQueryHandler<ListEcommerceBlockedContactsQuery, IReadOnlyList<EcommerceBlockedContactDto>>
{
    private readonly IEcommerceBlockedContactRepository _contacts;

    public ListEcommerceBlockedContactsHandler(IEcommerceBlockedContactRepository contacts)
    {
        _contacts = contacts;
    }

    public async Task<Result<IReadOnlyList<EcommerceBlockedContactDto>>> Handle(
        ListEcommerceBlockedContactsQuery query,
        CancellationToken ct)
    {
        var contacts = await _contacts.ListAsync(query.TenantId, ct).ConfigureAwait(false);

        IReadOnlyList<EcommerceBlockedContactDto> dtos = contacts
            .Select(Map)
            .ToList();

        return Result.Success(dtos);
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
