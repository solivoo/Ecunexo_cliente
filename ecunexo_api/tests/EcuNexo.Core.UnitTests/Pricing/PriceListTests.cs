using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class PriceListTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Creación de lista de precios válida normaliza código y moneda")]
    public void Create_ValidList_Succeeds()
    {
        var result = PriceList.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            " publico ",
            "Precio público",
            "Lista de mostrador",
            null,
            pricesIncludeTax: true,
            Today,
            null,
            priority: 1,
            isDefault: true);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Code.Should().Be("PUBLICO");
        result.Value!.Currency.Should().Be("USD");
        result.Value!.IsActive.Should().BeTrue();
        result.Value!.IsDefault.Should().BeTrue();
        result.Value!.PricesIncludeTax.Should().BeTrue();
    }

    [Fact(DisplayName = "Lista sin código es rechazada")]
    public void Create_WithoutCode_Fails()
    {
        var result = PriceList.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "  ",
            "Mayorista",
            null,
            null,
            pricesIncludeTax: false,
            Today,
            null,
            priority: 0,
            isDefault: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.code.required");
    }

    [Fact(DisplayName = "Lista con vigencia invertida es rechazada")]
    public void Create_InvalidRange_Fails()
    {
        var result = PriceList.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "WEB",
            "Web",
            null,
            "USD",
            pricesIncludeTax: false,
            Today,
            Today.AddDays(-1),
            priority: 0,
            isDefault: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.range");
    }

    [Fact(DisplayName = "La lista predeterminada no puede desactivarse")]
    public void SetActive_DefaultList_Fails()
    {
        var list = CreateList(isDefault: true);

        var result = list.SetActive(false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.default.required");
        list.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "Una lista inactiva no puede ser predeterminada")]
    public void SetDefault_InactiveList_Fails()
    {
        var list = CreateList(isDefault: false);
        list.SetActive(false).IsSuccess.Should().BeTrue();

        var result = list.SetDefault(true);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.default.inactive");
    }

    [Fact(DisplayName = "IsValidOn respeta estado y vigencia de la lista")]
    public void IsValidOn_RespectsStateAndRange()
    {
        var list = PriceList.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "MAYORISTA",
            "Mayorista",
            null,
            null,
            pricesIncludeTax: false,
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 6, 30),
            priority: 0,
            isDefault: false).Value!;

        list.IsValidOn(new DateOnly(2025, 12, 31)).Should().BeFalse();
        list.IsValidOn(new DateOnly(2026, 1, 1)).Should().BeTrue();
        list.IsValidOn(new DateOnly(2026, 6, 30)).Should().BeTrue();
        list.IsValidOn(new DateOnly(2026, 7, 1)).Should().BeFalse();

        list.SetActive(false).IsSuccess.Should().BeTrue();
        list.IsValidOn(new DateOnly(2026, 3, 1)).Should().BeFalse();
    }

    private static PriceList CreateList(bool isDefault) =>
        PriceList.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "PUBLICO",
            "Público",
            null,
            null,
            pricesIncludeTax: false,
            Today,
            null,
            priority: 0,
            isDefault: isDefault).Value!;
}
