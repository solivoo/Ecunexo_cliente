using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class TenantSriLegalProfileTests
{
    [Fact(DisplayName = "Guardar negocio popular fija nota de venta")]
    public void Popular_ResolvesNotaVenta()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Loma Soft",
            new ServicePlan("Independiente", 2, 0)).Value!;

        var updated = tenant.UpdateSriLegalProfile(
            "1710034567001",
            "Ana Loma",
            "Quito",
            "001",
            "Calle 1",
            accountingRequired: false,
            RimpeKind.PopularBusiness,
            preferElectronicInvoice: false,
            isExporter: false,
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: false);

        updated.IsSuccess.Should().BeTrue();
        tenant.IsRimpe.Should().BeTrue();
        tenant.RimpeKind.Should().Be(RimpeKind.PopularBusiness);
        tenant.ResolveSalesDocumentKind().Should().Be(SalesDocumentKind.NotaVenta);
    }

    [Fact(DisplayName = "Andes régimen general sigue en factura electrónica")]
    public void General_ResolvesFactura()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Andes",
            new ServicePlan("Empresa", 10, 3)).Value!;

        var updated = tenant.UpdateSriLegalProfile(
            "1792146736001",
            "Andes Retail Cía. Ltda.",
            "Quito",
            "001",
            "Av. Amazonas",
            accountingRequired: true,
            RimpeKind.None,
            preferElectronicInvoice: false,
            isExporter: false,
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: false);

        updated.IsSuccess.Should().BeTrue();
        tenant.ResolveSalesDocumentKind().Should().Be(SalesDocumentKind.FacturaElectronica);
    }
}
