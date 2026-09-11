using EcuNexo.Business.Catalog.Images;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class ImageProcessingServiceTests
{
    [Fact(DisplayName = "ImageProcessingService: procesa imagen y genera 3 variantes WebP optimizadas")]
    public async Task ProcessForEcommerceAsync_ValidImage_GeneratesThreeVariants()
    {
        // 1. Crear una imagen en memoria de 1200x800 en formato JPEG
        using var image = new Image<Rgba32>(1200, 800);
        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms);
        ms.Position = 0;

        var service = new ImageProcessingService();

        // Actuar
        var result = await service.ProcessForEcommerceAsync(
            ms,
            "producto-test.jpg",
            "image/jpeg",
            CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        var variants = result.Value!;

        variants.OriginalDimensions.Width.Should().Be(1200);
        variants.OriginalDimensions.Height.Should().Be(800);
        variants.ContentType.Should().Be("image/webp");

        variants.ThumbBytes.Should().NotBeEmpty();
        variants.MediumBytes.Should().NotBeEmpty();
        variants.LargeBytes.Should().NotBeEmpty();

        // Validar dimensiones de la variante Thumb (máx 200 px manteniendo aspect ratio)
        using var thumbImg = Image.Load(variants.ThumbBytes);
        thumbImg.Width.Should().BeLessThanOrEqualTo(200);
        thumbImg.Height.Should().BeLessThanOrEqualTo(200);

        // Validar dimensiones de la variante Medium (máx 800 px)
        using var mediumImg = Image.Load(variants.MediumBytes);
        mediumImg.Width.Should().BeLessThanOrEqualTo(800);
        mediumImg.Height.Should().BeLessThanOrEqualTo(800);

        // Validar dimensiones de la variante Large (máx 1600 px)
        using var largeImg = Image.Load(variants.LargeBytes);
        largeImg.Width.Should().BeLessThanOrEqualTo(1200); // No escala hacia arriba si original es 1200
        largeImg.Height.Should().BeLessThanOrEqualTo(800);
    }

    [Fact(DisplayName = "ImageProcessingService: rechaza imágenes con resolución menor a 400x400 px")]
    public async Task ProcessForEcommerceAsync_LowResolution_Fails()
    {
        using var image = new Image<Rgba32>(300, 300);
        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms);
        ms.Position = 0;

        var service = new ImageProcessingService();

        var result = await service.ProcessForEcommerceAsync(
            ms,
            "pequena.jpg",
            "image/jpeg",
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.image.resolution.too_low");
    }

    [Fact(DisplayName = "ImageProcessingService: procesa fotografía de evidencia, auto-orienta y escala a Full HD WebP")]
    public async Task ProcessEvidencePhotoAsync_LargeImage_ScalesToFullHdWebp()
    {
        // Crear imagen de 2500x1600 en PNG simulando foto de smartphone
        using var image = new Image<Rgba32>(2500, 1600);
        using var ms = new MemoryStream();
        await image.SaveAsPngAsync(ms);
        ms.Position = 0;

        var service = new ImageProcessingService();

        var result = await service.ProcessEvidencePhotoAsync(
            ms,
            "evidencia_golpe.png",
            "image/png",
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var photo = result.Value!;

        photo.ContentType.Should().Be("image/webp");
        photo.WebpBytes.Should().NotBeEmpty();

        using var webpImg = Image.Load(photo.WebpBytes);
        webpImg.Width.Should().BeLessThanOrEqualTo(1920);
        webpImg.Height.Should().BeLessThanOrEqualTo(1920);
    }
}
