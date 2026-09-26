using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateEcommerceBlockedContact;
using EcuNexo.Business.Ecommerce.Storefront.Commands.RemoveEcommerceBlockedContact;
using EcuNexo.Business.Ecommerce.Storefront.Queries.ListEcommerceBlockedContacts;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class EcommerceBlockedContactHandlerTests
{
    private readonly IEcommerceBlockedContactRepository _contacts = Substitute.For<IEcommerceBlockedContactRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public EcommerceBlockedContactHandlerTests()
    {
        _idGenerator.NewId().Returns(_ => Guid.CreateVersion7());
    }

    [Fact(DisplayName = "Bloquea un teléfono normalizando a solo dígitos")]
    public async Task Create_Phone_NormalizesAndPersists()
    {
        var tenantId = Guid.CreateVersion7();
        EcommerceBlockedContact? added = null;
        _contacts
            .AddAsync(Arg.Do<EcommerceBlockedContact>(contact => added = contact), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var sut = new CreateEcommerceBlockedContactHandler(_contacts, _idGenerator, _unitOfWork);
        var command = new CreateEcommerceBlockedContactCommand(
            tenantId,
            "Phone",
            "+593 99-999-9999",
            "Spam reiterado",
            Guid.CreateVersion7());

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Kind.Should().Be("Phone");
        result.Value.ValueNormalized.Should().Be("593999999999");
        added.Should().NotBeNull();
        added!.ValueNormalized.Should().Be("593999999999");
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "No bloquea un contacto duplicado")]
    public async Task Create_Duplicate_ReturnsConflict()
    {
        var tenantId = Guid.CreateVersion7();
        _contacts
            .ExistsAsync(
                tenantId,
                EcommerceBlockedContactKind.Email,
                "spam@example.com",
                Arg.Any<CancellationToken>())
            .Returns(true);

        var sut = new CreateEcommerceBlockedContactHandler(_contacts, _idGenerator, _unitOfWork);
        var command = new CreateEcommerceBlockedContactCommand(tenantId, "Email", "SPAM@example.com");

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.blocked_contact.already_exists");
        result.Error.Type.Should().Be(ErrorType.Conflict);
        await _contacts.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact(DisplayName = "Rechaza un tipo de contacto desconocido")]
    public async Task Create_UnknownKind_ReturnsValidationError()
    {
        var sut = new CreateEcommerceBlockedContactHandler(_contacts, _idGenerator, _unitOfWork);

        var result = await sut.Handle(
            new CreateEcommerceBlockedContactCommand(Guid.CreateVersion7(), "Fax", "123"),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.blocked_contact.kind_invalid");
    }

    [Fact(DisplayName = "Elimina un contacto bloqueado existente")]
    public async Task Remove_ExistingContact_Deletes()
    {
        var tenantId = Guid.CreateVersion7();
        var contact = EcommerceBlockedContact.Create(
            Guid.CreateVersion7(),
            tenantId,
            EcommerceBlockedContactKind.Email,
            "spam@example.com").Value!;
        _contacts.GetByIdAsync(tenantId, contact.Id, Arg.Any<CancellationToken>()).Returns(contact);

        var sut = new RemoveEcommerceBlockedContactHandler(_contacts, _unitOfWork);
        var result = await sut.Handle(
            new RemoveEcommerceBlockedContactCommand(tenantId, contact.Id),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _contacts.Received(1).Remove(contact);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Lista los contactos bloqueados del tenant")]
    public async Task List_ReturnsMappedContacts()
    {
        var tenantId = Guid.CreateVersion7();
        var contact = EcommerceBlockedContact.Create(
            Guid.CreateVersion7(),
            tenantId,
            EcommerceBlockedContactKind.Phone,
            "0999999999",
            "Abuso").Value!;
        _contacts.ListAsync(tenantId, Arg.Any<CancellationToken>()).Returns([contact]);

        var sut = new ListEcommerceBlockedContactsHandler(_contacts);
        var result = await sut.Handle(new ListEcommerceBlockedContactsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var contacts = result.Value!;
        contacts.Should().ContainSingle();
        contacts[0].ValueNormalized.Should().Be("0999999999");
        contacts[0].Reason.Should().Be("Abuso");
    }
}
