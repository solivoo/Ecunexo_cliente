using EcuNexo.Business.Catalog.Commands.UploadTenantMedia;
using EcuNexo.Business.Catalog.Images;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class UploadTenantMediaHandlerTests
{
    private readonly IImageProcessingService _processor = Substitute.For<IImageProcessingService>();
    private readonly IStorageService _storage = Substitute.For<IStorageService>();

    private UploadTenantMediaHandler CreateSut() => new(_processor, _storage);

    [Fact(DisplayName = "Subir media válida genera 3 variantes y devuelve URLs")]
    public async Task Handle_WithValidImage_UploadsThreeVariants()
    {
        var tenantId = Guid.CreateVersion7();
        var processed = new ProcessedImageVariants(
            OriginalDimensions: new ImageDimensions(1200, 900),
            OriginalFileSizeBytes: 2048,
            ThumbBytes: [1, 2, 3],
            MediumBytes: [4, 5],
            LargeBytes: [6, 7, 8, 9]);

        _processor.ProcessForEcommerceAsync(
                Arg.Any<Stream>(),
                "foto.jpg",
                "image/jpeg",
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(processed));

        _storage.UploadPublicAsync(
                Arg.Any<string>(),
                Arg.Any<Stream>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns("https://cdn.example/media.webp");

        using var stream = new MemoryStream([1, 2, 3]);
        var result = await CreateSut().Handle(
            new UploadTenantMediaCommand(tenantId, stream, "foto.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.StartsWith($"tenants/{tenantId:N}/media/", result.Value!.StorageKey);
        Assert.Equal(1200, result.Value.Width);
        Assert.Equal(900, result.Value.Height);
        Assert.Equal(2048, result.Value.FileSizeBytes);
        Assert.Equal("https://cdn.example/media.webp", result.Value.LargeUrl);
        await _storage.Received(3).UploadPublicAsync(
            Arg.Any<string>(),
            Arg.Any<Stream>(),
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Subir media sin tenant falla con validación")]
    public async Task Handle_WithEmptyTenant_FailsValidation()
    {
        using var stream = new MemoryStream([1]);
        var result = await CreateSut().Handle(
            new UploadTenantMediaCommand(Guid.Empty, stream, "foto.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.media.tenant.invalid", result.Error!.Code);
        await _processor.DidNotReceive().ProcessForEcommerceAsync(
            Arg.Any<Stream>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Si el procesamiento de imagen falla, no se sube nada")]
    public async Task Handle_WhenProcessingFails_ReturnsError()
    {
        var tenantId = Guid.CreateVersion7();
        _processor.ProcessForEcommerceAsync(
                Arg.Any<Stream>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Failure<ProcessedImageVariants>(
                new Error("catalog.image.invalid", "Formato no soportado.", ErrorType.Validation)));

        using var stream = new MemoryStream([1]);
        var result = await CreateSut().Handle(
            new UploadTenantMediaCommand(tenantId, stream, "nota.txt", "text/plain"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.image.invalid", result.Error!.Code);
        await _storage.DidNotReceive().UploadPublicAsync(
            Arg.Any<string>(),
            Arg.Any<Stream>(),
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }
}
