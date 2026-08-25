using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class SalesDocumentPolicyTests
{
    [Fact(DisplayName = "Negocio popular sin opción electrónica emite nota de venta")]
    public void Popular_Default_IsNotaVenta()
    {
        SalesDocumentPolicy.Resolve(RimpeKind.PopularBusiness, preferElectronicInvoice: false)
            .Should().Be(SalesDocumentKind.NotaVenta);
    }

    [Fact(DisplayName = "Negocio popular puede elegir factura electrónica")]
    public void Popular_PrefersElectronic_IsFactura()
    {
        SalesDocumentPolicy.Resolve(RimpeKind.PopularBusiness, preferElectronicInvoice: true)
            .Should().Be(SalesDocumentKind.FacturaElectronica);
    }

    [Theory(DisplayName = "Régimen general y emprendedor emiten factura electrónica")]
    [InlineData(RimpeKind.None, false)]
    [InlineData(RimpeKind.None, true)]
    [InlineData(RimpeKind.Entrepreneur, false)]
    [InlineData(RimpeKind.Entrepreneur, true)]
    public void GeneralAndEntrepreneur_AreFactura(RimpeKind kind, bool preferElectronic)
    {
        SalesDocumentPolicy.Resolve(kind, preferElectronic)
            .Should().Be(SalesDocumentKind.FacturaElectronica);
    }

    [Fact(DisplayName = "Negocio popular no puede ser agente de retención")]
    public void Popular_Withholding_Fails()
    {
        var result = SalesDocumentPolicy.ValidateLegalCombination(
            RimpeKind.PopularBusiness,
            "1710034567001",
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: true);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("tenant.sri.rimpe.popular_withholding");
    }

    [Fact(DisplayName = "Negocio popular no admite RUC de sociedad")]
    public void Popular_SocietyRuc_Fails()
    {
        var result = SalesDocumentPolicy.ValidateLegalCombination(
            RimpeKind.PopularBusiness,
            "1792146736001",
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("tenant.sri.rimpe.popular_society");
    }

    [Fact(DisplayName = "Bool legado RIMPE se lee como Emprendedor")]
    public void FromApi_LegacyTrue_IsEntrepreneur()
    {
        RimpeKindCodes.FromApi(null, isRimpe: true).Should().Be(RimpeKind.Entrepreneur);
        RimpeKindCodes.FromApi(null, isRimpe: false).Should().Be(RimpeKind.None);
        RimpeKindCodes.FromApi("popular-business", isRimpe: false).Should().Be(RimpeKind.PopularBusiness);
    }
}
