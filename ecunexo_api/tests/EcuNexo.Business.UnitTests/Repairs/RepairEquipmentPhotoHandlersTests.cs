using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Images;
using EcuNexo.Business.Repairs.Commands.DeleteRepairEquipmentPhoto;
using EcuNexo.Business.Repairs.Commands.UploadRepairEquipmentPhoto;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Repairs;

public sealed class RepairEquipmentPhotoHandlersTests
{
    private readonly IRepairEquipmentRepository _equipmentRepo = Substitute.For<IRepairEquipmentRepository>();
    private readonly IStorageService _storageService = Substitute.For<IStorageService>();
    private readonly IImageProcessingService _imageProcessor = Substitute.For<IImageProcessingService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "UploadRepairEquipmentPhotoHandler: procesa, sube a B2 y agrega foto al aggregate")]
    public async Task UploadRepairEquipmentPhotoHandler_Valid_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var equipmentId = Guid.NewGuid();
        var batchId = Guid.NewGuid();

        var equipment = RepairEquipment.Create(
            equipmentId, tenantId, batchId, "SN-TEST-IMG", "WWG16", "Whirlpool", DamageLevel.Level1).Value!;

        _equipmentRepo.GetTrackedAsync(tenantId, equipmentId, Arg.Any<CancellationToken>())
            .Returns(equipment);

        _storageService.PublicBucket.Returns("ecunexo-publico-assets");
        _storageService.UploadPublicAsync(Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("https://s3.us-east-005.backblazeb2.com/ecunexo-publico-assets/test.webp");

        var processed = new ProcessedEvidencePhoto(
            WebpBytes: [1, 2, 3, 4],
            ContentType: "image/webp",
            Width: 1200,
            Height: 800,
            OriginalFileSizeBytes: 10000);

        _imageProcessor.ProcessEvidencePhotoAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(processed));

        var handler = new UploadRepairEquipmentPhotoHandler(_equipmentRepo, _storageService, _imageProcessor, _unitOfWork);

        using var ms = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadRepairEquipmentPhotoCommand(
            TenantId: tenantId,
            EquipmentId: equipmentId,
            Content: ms,
            FileName: "dano.jpg",
            ContentType: "image/jpeg",
            Stage: PhotoStage.DamageInitial,
            Caption: "Abolladura frontal",
            UploadedBy: Guid.NewGuid());

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.EquipmentId.Should().Be(equipmentId);
        result.Value!.Stage.Should().Be(PhotoStage.DamageInitial);
        result.Value!.Caption.Should().Be("Abolladura frontal");
        result.Value!.DownloadUrl.Should().Contain("test.webp");

        equipment.Photos.Should().HaveCount(1);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "DeleteRepairEquipmentPhotoHandler: remueve foto de aggregate y elimina de S3")]
    public async Task DeleteRepairEquipmentPhotoHandler_ExistingPhoto_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var equipmentId = Guid.NewGuid();
        var batchId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        var equipment = RepairEquipment.Create(
            equipmentId, tenantId, batchId, "SN-TEST-DEL", "WWG16", "Whirlpool", DamageLevel.Level1).Value!;

        equipment.AddPhoto(
            photoId,
            PhotoStage.DamageInitial,
            "ecunexo-publico-assets",
            "tenants/key.webp",
            "dano.webp",
            2048);

        _equipmentRepo.GetTrackedAsync(tenantId, equipmentId, Arg.Any<CancellationToken>())
            .Returns(equipment);

        var handler = new DeleteRepairEquipmentPhotoHandler(_equipmentRepo, _storageService, _unitOfWork);

        var command = new DeleteRepairEquipmentPhotoCommand(
            TenantId: tenantId,
            EquipmentId: equipmentId,
            PhotoId: photoId);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        equipment.Photos.Should().BeEmpty();
        await _storageService.Received(1).DeleteAsync("ecunexo-publico-assets", "tenants/key.webp", Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
