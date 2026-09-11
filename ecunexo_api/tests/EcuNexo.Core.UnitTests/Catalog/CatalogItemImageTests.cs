using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.UnitTests.Support;

namespace EcuNexo.Core.UnitTests.Catalog;

public sealed class CatalogItemImageTests
{
    [Fact(DisplayName = "ImageDimensions: rechaza dimensiones menores o iguales a cero")]
    public void ImageDimensions_InvalidDimensions_Fails()
    {
        var resultZero = ImageDimensions.Create(0, 500);
        resultZero.IsFailure.Should().BeTrue();
        resultZero.Error!.Code.Should().Be("catalog.item.image.dimensions.invalid");

        var resultNegative = ImageDimensions.Create(800, -10);
        resultNegative.IsFailure.Should().BeTrue();
    }

    [Fact(DisplayName = "ImageOptimizationPolicy: valida formato de imagen admitido y rechaza no soportados")]
    public void ImageOptimizationPolicy_FormatValidation()
    {
        // Válidos
        var validJpg = ImageOptimizationPolicy.ValidateUploadRequest("image/jpeg", "foto.jpg", 1024 * 500, 800, 800);
        validJpg.IsSuccess.Should().BeTrue();

        var validPng = ImageOptimizationPolicy.ValidateUploadRequest("image/png", "item.png", 1024 * 800, 1000, 1000);
        validPng.IsSuccess.Should().BeTrue();

        var validWebp = ImageOptimizationPolicy.ValidateUploadRequest("image/webp", "producto.webp", 1024 * 200, 600, 600);
        validWebp.IsSuccess.Should().BeTrue();

        // Inválidos
        var invalidBmp = ImageOptimizationPolicy.ValidateUploadRequest("image/bmp", "foto.bmp", 1024 * 500, 800, 800);
        invalidBmp.IsFailure.Should().BeTrue();
        invalidBmp.Error!.Code.Should().Be("catalog.item.image.format.unsupported");

        var invalidPdf = ImageOptimizationPolicy.ValidateUploadRequest("application/pdf", "doc.pdf", 1024 * 500, 800, 800);
        invalidPdf.IsFailure.Should().BeTrue();
    }

    [Fact(DisplayName = "ImageOptimizationPolicy: valida límites de peso y resolución para e-commerce")]
    public void ImageOptimizationPolicy_SizeAndResolutionLimits()
    {
        // Peso excedido (> 8 MB)
        var heavy = ImageOptimizationPolicy.ValidateUploadRequest("image/jpeg", "heavy.jpg", 9 * 1024 * 1024, 1200, 1200);
        heavy.IsFailure.Should().BeTrue();
        heavy.Error!.Code.Should().Be("catalog.item.image.size.exceeded");

        // Resolución muy baja (< 400x400)
        var lowRes = ImageOptimizationPolicy.ValidateUploadRequest("image/jpeg", "tiny.jpg", 50 * 1024, 200, 200);
        lowRes.IsFailure.Should().BeTrue();
        lowRes.Error!.Code.Should().Be("catalog.item.image.resolution.too_low");

        // Archivo vacío (0 bytes)
        var empty = ImageOptimizationPolicy.ValidateUploadRequest("image/jpeg", "zero.jpg", 0, 800, 800);
        empty.IsFailure.Should().BeTrue();
        empty.Error!.Code.Should().Be("catalog.item.image.file.empty");
    }

    [Fact(DisplayName = "CatalogItem: la primera imagen agregada se convierte en Principal automáticamente")]
    public void AddImage_FirstImage_BecomesMain()
    {
        var item = CatalogTestFactory.Physical();
        var imgId = Guid.CreateVersion7();
        var dims = new ImageDimensions(1200, 1200);

        var result = item.AddImage(
            imgId,
            "tenants/t1/items/i1/img1.webp",
            "producto.jpg",
            "Vista frontal del producto",
            dims,
            1024 * 150,
            thumbUrl: "https://assets.ecunexo.com/img1_thumb.webp",
            mediumUrl: "https://assets.ecunexo.com/img1_med.webp",
            largeUrl: "https://assets.ecunexo.com/img1_large.webp");

        result.IsSuccess.Should().BeTrue();
        item.Images.Should().HaveCount(1);

        var first = item.Images.First();
        first.IsMain.Should().BeTrue();
        first.DisplayOrder.Should().Be(1);
        first.AltText.Should().Be("Vista frontal del producto");
    }

    [Fact(DisplayName = "CatalogItem: la segunda imagen no es principal a menos que se indique explícitamente")]
    public void AddImage_SubsequentImages_OnlyOneMain()
    {
        var item = CatalogTestFactory.Physical();
        var dims = new ImageDimensions(800, 800);

        var img1 = item.AddImage(Guid.CreateVersion7(), "k1", "f1.jpg", null, dims, 100, "t1", "m1", "l1").Value!;
        var img2 = item.AddImage(Guid.CreateVersion7(), "k2", "f2.jpg", null, dims, 100, "t2", "m2", "l2").Value!;

        img1.IsMain.Should().BeTrue();
        img2.IsMain.Should().BeFalse();
        img2.DisplayOrder.Should().Be(2);

        // Agregar tercera marcándola como principal
        var img3 = item.AddImage(Guid.CreateVersion7(), "k3", "f3.jpg", null, dims, 100, "t3", "m3", "l3", setAsMain: true).Value!;

        img3.IsMain.Should().BeTrue();
        item.Images.First(i => i.Id == img1.Id).IsMain.Should().BeFalse();
        item.Images.First(i => i.Id == img2.Id).IsMain.Should().BeFalse();
    }

    [Fact(DisplayName = "CatalogItem: no permite superar el límite de 8 imágenes por producto")]
    public void AddImage_LimitExceeded_Fails()
    {
        var item = CatalogTestFactory.Physical();
        var dims = new ImageDimensions(800, 800);

        for (var i = 0; i < ImageOptimizationPolicy.MaxImagesPerItem; i++)
        {
            var res = item.AddImage(Guid.CreateVersion7(), $"k{i}", $"f{i}.jpg", null, dims, 100, $"t{i}", $"m{i}", $"l{i}");
            res.IsSuccess.Should().BeTrue();
        }

        // Intento 9
        var ninthResult = item.AddImage(Guid.CreateVersion7(), "k9", "f9.jpg", null, dims, 100, "t9", "m9", "l9");
        ninthResult.IsFailure.Should().BeTrue();
        ninthResult.Error!.Code.Should().Be("catalog.item.image.limit.exceeded");
    }

    [Fact(DisplayName = "CatalogItem: al eliminar la imagen principal, la siguiente asume el rol de principal")]
    public void RemoveImage_WhenMainIsRemoved_NextPromotedToMain()
    {
        var item = CatalogTestFactory.Physical();
        var dims = new ImageDimensions(800, 800);

        var img1 = item.AddImage(Guid.CreateVersion7(), "k1", "f1.jpg", null, dims, 100, "t1", "m1", "l1").Value!;
        var img2 = item.AddImage(Guid.CreateVersion7(), "k2", "f2.jpg", null, dims, 100, "t2", "m2", "l2").Value!;

        item.RemoveImage(img1.Id).IsSuccess.Should().BeTrue();

        item.Images.Should().HaveCount(1);
        var remaining = item.Images.First();
        remaining.Id.Should().Be(img2.Id);
        remaining.IsMain.Should().BeTrue();
        remaining.DisplayOrder.Should().Be(1);
    }

    [Fact(DisplayName = "CatalogItem: reordenar imágenes actualiza DisplayOrder coherentemente")]
    public void ReorderImages_Success()
    {
        var item = CatalogTestFactory.Physical();
        var dims = new ImageDimensions(800, 800);

        var img1 = item.AddImage(Guid.CreateVersion7(), "k1", "f1.jpg", null, dims, 100, "t1", "m1", "l1").Value!;
        var img2 = item.AddImage(Guid.CreateVersion7(), "k2", "f2.jpg", null, dims, 100, "t2", "m2", "l2").Value!;
        var img3 = item.AddImage(Guid.CreateVersion7(), "k3", "f3.jpg", null, dims, 100, "t3", "m3", "l3").Value!;

        // Invertir orden: 3, 1, 2
        var reorderResult = item.ReorderImages([img3.Id, img1.Id, img2.Id]);
        reorderResult.IsSuccess.Should().BeTrue();

        item.Images.First(i => i.Id == img3.Id).DisplayOrder.Should().Be(1);
        item.Images.First(i => i.Id == img1.Id).DisplayOrder.Should().Be(2);
        item.Images.First(i => i.Id == img2.Id).DisplayOrder.Should().Be(3);
    }
}
