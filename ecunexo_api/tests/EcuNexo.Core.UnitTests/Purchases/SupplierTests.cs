using EcuNexo.Core.Purchases;

namespace EcuNexo.Core.UnitTests.Purchases;

public sealed class SupplierTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact(DisplayName = "Supplier.Create con RUC Sociedad Privada válido (tercer dígito 9) es exitoso")]
    public void Supplier_Create_WithValidPrivateCompanyRuc_Succeeds()
    {
        // 0992345671001: RUC Sociedad Privada válido en Guayas (provincia 09)
        var supplierId = Guid.NewGuid();
        var result = Supplier.Create(
            id: supplierId,
            tenantId: TenantId,
            businessName: "Importadora Tecnológica del Pacífico S.A.",
            taxId: "0992345675001",
            identificationType: SupplierIdentificationType.Ruc,
            taxRegime: SupplierTaxRegime.General,
            tradeName: "TecnoPacífico",
            isRetentionAgent: true,
            resolutionNumber: "NAC-DNCRASC20-00000001",
            contactEmail: "ventas@tecnopacifico.ec",
            creditDays: 30,
            creditLimit: 5000.00m);

        result.IsSuccess.Should().BeTrue();
        var supplier = result.Value!;
        supplier.Id.Should().Be(supplierId);
        supplier.BusinessName.Should().Be("Importadora Tecnológica del Pacífico S.A.");
        supplier.TaxId.Should().Be("0992345675001");
        supplier.IdentificationType.Should().Be(SupplierIdentificationType.Ruc);
        supplier.TaxRegime.Should().Be(SupplierTaxRegime.General);
        supplier.IsRetentionAgent.Should().BeTrue();
        supplier.ResolutionNumber.Should().Be("NAC-DNCRASC20-00000001");
        supplier.ContactEmail.Should().Be("ventas@tecnopacifico.ec");
        supplier.CreditDays.Should().Be(30);
        supplier.CreditLimit.Should().Be(5000.00m);
        supplier.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "Supplier.Create con RUC inválido falla con error de validación SRI")]
    public void Supplier_Create_WithInvalidRuc_Fails()
    {
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Proveedor Falso S.A.",
            taxId: "0992345679001", // Dígito verificador incorrecto (debería ser 5)
            identificationType: SupplierIdentificationType.Ruc,
            contactEmail: "contacto@proveedor.ec");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("supplier.tax_id.ruc.invalid");
    }

    [Fact(DisplayName = "Supplier.Create con Cédula válida Módulo 10 es exitoso")]
    public void Supplier_Create_WithValidCedula_Succeeds()
    {
        // 0923456784: Cédula válida en Guayas
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Carlos Alberto Mendoza",
            taxId: "0923456784",
            identificationType: SupplierIdentificationType.Cedula,
            taxRegime: SupplierTaxRegime.RimpeEmprendedor,
            contactEmail: "carlos@mendoza.ec");

        result.IsSuccess.Should().BeTrue();
        result.Value!.IdentificationType.Should().Be(SupplierIdentificationType.Cedula);
        result.Value!.TaxRegime.Should().Be(SupplierTaxRegime.RimpeEmprendedor);
    }

    [Fact(DisplayName = "Supplier.Create con Cédula inválida (dígito verificador incorrecto) falla")]
    public void Supplier_Create_WithInvalidCedula_Fails()
    {
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Persona Invalida",
            taxId: "0923456780", // Dígito incorrecto (debería ser 4)
            identificationType: SupplierIdentificationType.Cedula,
            contactEmail: "invalida@test.ec");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("supplier.tax_id.cedula.invalid");
    }

    [Fact(DisplayName = "Supplier.Create con Pasaporte válido de longitud adecuada es exitoso")]
    public void Supplier_Create_WithPassport_Succeeds()
    {
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Global Trade Logistics LLC",
            taxId: "USA987654321",
            identificationType: SupplierIdentificationType.Pasaporte,
            contactEmail: "ops@globaltrade.com");

        result.IsSuccess.Should().BeTrue();
        result.Value!.IdentificationType.Should().Be(SupplierIdentificationType.Pasaporte);
    }

    [Fact(DisplayName = "Supplier.Create sin correo de contacto falla con error requerido")]
    public void Supplier_Create_WithoutEmail_Fails()
    {
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Proveedor Sin Correo",
            taxId: "0992345675001",
            identificationType: SupplierIdentificationType.Ruc,
            contactEmail: null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("supplier.contact_email.empty");
    }

    [Fact(DisplayName = "Supplier.Create con formato de correo inválido falla")]
    public void Supplier_Create_WithInvalidEmailFormat_Fails()
    {
        var result = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Proveedor Email Malo",
            taxId: "0992345675001",
            identificationType: SupplierIdentificationType.Ruc,
            contactEmail: "correo_sin_arroba_ni_dominio");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("supplier.contact_email.invalid");
    }

    [Fact(DisplayName = "Supplier.Update actualiza campos y audita fecha")]
    public void Supplier_Update_ModifiesFields_Succeeds()
    {
        var supplier = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Original S.A.",
            taxId: "0992345675001",
            contactEmail: "contacto@original.ec").Value!;

        var updateResult = supplier.Update(
            businessName: "Nombre Modificado S.A.",
            taxId: "0992345675001",
            identificationType: SupplierIdentificationType.Ruc,
            taxRegime: SupplierTaxRegime.ContribuyenteEspecial,
            tradeName: "Marca Actualizada",
            isRetentionAgent: true,
            resolutionNumber: "RES-2026-99",
            contactEmail: "nuevo@proveedor.com",
            creditDays: 45,
            creditLimit: 12000m);

        updateResult.IsSuccess.Should().BeTrue();
        supplier.BusinessName.Should().Be("Nombre Modificado S.A.");
        supplier.TradeName.Should().Be("Marca Actualizada");
        supplier.TaxRegime.Should().Be(SupplierTaxRegime.ContribuyenteEspecial);
        supplier.ResolutionNumber.Should().Be("RES-2026-99");
        supplier.ContactEmail.Should().Be("nuevo@proveedor.com");
        supplier.CreditDays.Should().Be(45);
        supplier.CreditLimit.Should().Be(12000m);
        supplier.UpdatedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Supplier.SoftDelete desactiva y asigna DeletedAt")]
    public void Supplier_SoftDelete_DeactivatesAndMarksDeleted()
    {
        var supplier = Supplier.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            businessName: "Eliminar S.A.",
            taxId: "0992345675001",
            contactEmail: "eliminar@empresa.ec").Value!;

        var delResult = supplier.SoftDelete();

        delResult.IsSuccess.Should().BeTrue();
        supplier.IsActive.Should().BeFalse();
        supplier.DeletedAt.Should().NotBeNull();
    }
}
