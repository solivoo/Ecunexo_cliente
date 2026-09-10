using EcuNexo.Core.Customers;

namespace EcuNexo.Core.UnitTests.Customers;

public sealed class CustomerEntitiesTests
{
    [Theory(DisplayName = "Customer.Create con diferentes CustomerType es exitoso")]
    [InlineData(CustomerType.CorporativoB2B)]
    [InlineData(CustomerType.PersonaNatural)]
    [InlineData(CustomerType.DistribuidorMayorista)]
    [InlineData(CustomerType.TallerAliado)]
    [InlineData(CustomerType.ConsumidorFinal)]
    [InlineData(CustomerType.InstitucionPublica)]
    public void Customer_Create_WithValidTypes_Succeeds(CustomerType type)
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var result = Customer.Create(
            id,
            tenantId,
            "Empresa Ejemplo S.A.",
            customerType: type);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CustomerType.Should().Be(type);
        result.Value!.Name.Should().Be("Empresa Ejemplo S.A.");
        result.Value!.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "Customer.Create con RUC válido (13 dígitos) asigna identificación")]
    public void Customer_Create_WithValidRuc_Succeeds()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Whirlpool del Ecuador S.A.",
            taxId: "0992345671001",
            identificationType: CustomerIdentificationType.Ruc);

        result.IsSuccess.Should().BeTrue();
        result.Value!.IdentificationType.Should().Be(CustomerIdentificationType.Ruc);
        result.Value!.TaxId.Should().Be("0992345671001");
    }

    [Fact(DisplayName = "Customer.Create con Cédula válida (10 dígitos) asigna identificación")]
    public void Customer_Create_WithValidCedula_Succeeds()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Juan Pérez",
            taxId: "0923456789",
            customerType: CustomerType.PersonaNatural,
            identificationType: CustomerIdentificationType.Cedula);

        result.IsSuccess.Should().BeTrue();
        result.Value!.IdentificationType.Should().Be(CustomerIdentificationType.Cedula);
        result.Value!.TaxId.Should().Be("0923456789");
    }

    [Fact(DisplayName = "Customer.Create con Consumidor Final sin taxId asigna 9999999999999 por defecto")]
    public void Customer_Create_WithConsumidorFinal_SetsDefaultTaxId()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Consumidor Final Mostrador",
            taxId: null,
            customerType: CustomerType.ConsumidorFinal,
            identificationType: CustomerIdentificationType.ConsumidorFinal);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TaxId.Should().Be("9999999999999");
    }

    [Fact(DisplayName = "Customer.Create con Cédula de longitud incorrecta devuelve error")]
    public void Customer_Create_WithInvalidCedula_Fails()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Cliente Inválido",
            taxId: "12345",
            identificationType: CustomerIdentificationType.Cedula);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("customer.tax_id.cedula.invalid");
    }

    [Fact(DisplayName = "Customer.Create con RUC no numérico o longitud inválida devuelve error")]
    public void Customer_Create_WithInvalidRuc_Fails()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Cliente Inválido",
            taxId: "099234567100A",
            identificationType: CustomerIdentificationType.Ruc);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("customer.tax_id.ruc.invalid");
    }

    [Fact(DisplayName = "Customer.Create con CustomerType inválido (<= 0) devuelve error")]
    public void Customer_Create_WithInvalidType_Fails()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Cliente Tipo Inválido",
            customerType: (CustomerType)0);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("customer.type.invalid");
    }

    [Fact(DisplayName = "Customer.Create acepta códigos de tipo personalizados (>= 100)")]
    public void Customer_Create_WithCustomTypeCode_Succeeds()
    {
        var result = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Cliente Tipo Personalizado",
            customerType: (CustomerType)100);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CustomerType.Should().Be((CustomerType)100);
    }

    [Fact(DisplayName = "Customer.ChangeClassification actualiza la clasificación y fecha de modificación")]
    public void Customer_ChangeClassification_UpdatesType()
    {
        var customer = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Taller Hermanos Gómez",
            customerType: CustomerType.PersonaNatural).Value!;

        var result = customer.ChangeClassification(CustomerType.TallerAliado);

        result.IsSuccess.Should().BeTrue();
        customer.CustomerType.Should().Be(CustomerType.TallerAliado);
        customer.UpdatedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Customer.SetIdentification actualiza tipo tributario y número fiscal")]
    public void Customer_SetIdentification_UpdatesIdentification()
    {
        var customer = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Distribuidora El Oro",
            customerType: CustomerType.DistribuidorMayorista).Value!;

        var result = customer.SetIdentification(CustomerIdentificationType.Ruc, "0791234567001");

        result.IsSuccess.Should().BeTrue();
        customer.IdentificationType.Should().Be(CustomerIdentificationType.Ruc);
        customer.TaxId.Should().Be("0791234567001");
        customer.UpdatedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Customer.Update con todos los campos actualiza entidad correctamente")]
    public void Customer_Update_WithValidData_Succeeds()
    {
        var customer = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Nombre Original",
            customerType: CustomerType.PersonaNatural).Value!;

        var updateResult = customer.Update(
            "Razón Social Actualizada S.A.",
            "1792345678001",
            "info@actualizada.ec",
            "022123456",
            "Av. Amazonas y Colón",
            "Lic. Mariana Cruz",
            "Cliente preferencial B2B",
            CustomerType.CorporativoB2B,
            CustomerIdentificationType.Ruc);

        updateResult.IsSuccess.Should().BeTrue();
        customer.Name.Should().Be("Razón Social Actualizada S.A.");
        customer.TaxId.Should().Be("1792345678001");
        customer.CustomerType.Should().Be(CustomerType.CorporativoB2B);
        customer.IdentificationType.Should().Be(CustomerIdentificationType.Ruc);
        customer.ContactEmail.Should().Be("info@actualizada.ec");
        customer.ContactPhone.Should().Be("022123456");
        customer.Address.Should().Be("Av. Amazonas y Colón");
        customer.ContactPerson.Should().Be("Lic. Mariana Cruz");
        customer.Notes.Should().Be("Cliente preferencial B2B");
    }

    [Fact(DisplayName = "Customer.Activate, Deactivate y SoftDelete modifican estados correctamente")]
    public void Customer_StatusAndSoftDelete_TransitionsCorrectly()
    {
        var customer = Customer.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Empresa Prueba").Value!;

        customer.IsActive.Should().BeTrue();

        customer.Deactivate();
        customer.IsActive.Should().BeFalse();

        customer.Activate();
        customer.IsActive.Should().BeTrue();

        var userId = Guid.NewGuid();
        customer.SoftDelete(userId);
        customer.DeletedAt.Should().NotBeNull();
        customer.DeletedBy.Should().Be(userId);
    }
}
