using EcuNexo.Core.Customers;

namespace EcuNexo.Core.UnitTests.Customers;

public sealed class EcuadorCustomerLookupHelperTests
{
    [Theory(DisplayName = "DeriveCity mapea correctamente los códigos de provincia a ciudad de Ecuador")]
    [InlineData("1792345678001", "Quito")]
    [InlineData("1712345678", "Quito")]
    [InlineData("0992345671001", "Guayaquil")]
    [InlineData("0102030405", "Cuenca")]
    [InlineData("0701234567", "Machala")]
    [InlineData("1801234567", "Ambato")]
    public void DeriveCity_ValidTaxId_ReturnsExpectedCity(string taxId, string expectedCity)
    {
        var city = EcuadorCustomerLookupHelper.DeriveCity(taxId);
        city.Should().Be(expectedCity);
    }

    [Fact(DisplayName = "DeriveCity con taxId nulo o inválido retorna null")]
    public void DeriveCity_InvalidTaxId_ReturnsNull()
    {
        EcuadorCustomerLookupHelper.DeriveCity(null).Should().BeNull();
        EcuadorCustomerLookupHelper.DeriveCity("").Should().BeNull();
        EcuadorCustomerLookupHelper.DeriveCity("1").Should().BeNull();
        EcuadorCustomerLookupHelper.DeriveCity("99").Should().BeNull(); // No provincia 99
    }

    [Fact(DisplayName = "InferTypes infiere Cédula, RUC B2B, RUC Público y Consumidor Final")]
    public void InferTypes_CategorizesCorrectly()
    {
        var (idType1, custType1) = EcuadorCustomerLookupHelper.InferTypes("9999999999999");
        idType1.Should().Be(CustomerIdentificationType.ConsumidorFinal);
        custType1.Should().Be(CustomerType.ConsumidorFinal);

        var (idType2, custType2) = EcuadorCustomerLookupHelper.InferTypes("1712345678");
        idType2.Should().Be(CustomerIdentificationType.Cedula);
        custType2.Should().Be(CustomerType.PersonaNatural);

        var (idType3, custType3) = EcuadorCustomerLookupHelper.InferTypes("1791234567001");
        idType3.Should().Be(CustomerIdentificationType.Ruc);
        custType3.Should().Be(CustomerType.CorporativoB2B);

        var (idType4, custType4) = EcuadorCustomerLookupHelper.InferTypes("1760001230001");
        idType4.Should().Be(CustomerIdentificationType.Ruc);
        custType4.Should().Be(CustomerType.InstitucionPublica);
    }
}
