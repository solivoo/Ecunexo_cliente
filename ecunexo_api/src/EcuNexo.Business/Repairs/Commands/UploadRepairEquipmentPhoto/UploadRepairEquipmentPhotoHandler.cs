using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Images;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Repairs.Commands.UploadRepairEquipmentPhoto;

public sealed class UploadRepairEquipmentPhotoHandler : ICommandHandler<UploadRepairEquipmentPhotoCommand, RepairEquipmentPhotoResponse>
{
    private readonly IRepairEquipmentRepository _equipmentRepo;
    private readonly IStorageService _storageService;
    private readonly IImageProcessingService _imageProcessor;
    private readonly IUnitOfWork _unitOfWork;

    public UploadRepairEquipmentPhotoHandler(
        IRepairEquipmentRepository equipmentRepo,
        IStorageService storageService,
        IImageProcessingService imageProcessor,
        IUnitOfWork unitOfWork)
    {
        _equipmentRepo = equipmentRepo;
        _storageService = storageService;
        _imageProcessor = imageProcessor;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<RepairEquipmentPhotoResponse>> Handle(
        UploadRepairEquipmentPhotoCommand command,
        CancellationToken ct)
    {
        var equipment = await _equipmentRepo.GetTrackedAsync(command.TenantId, command.EquipmentId, ct).ConfigureAwait(false);
        if (equipment == null)
        {
            return Result.Failure<RepairEquipmentPhotoResponse>(new Error(
                "repairs.equipment.not_found",
                "El equipo no fue encontrado o no pertenece a este tenant.",
                ErrorType.NotFound));
        }

        // Procesar y optimizar fotografía a WebP
        var processResult = await _imageProcessor.ProcessEvidencePhotoAsync(
            command.Content,
            command.FileName,
            command.ContentType,
            ct).ConfigureAwait(false);

        if (processResult.IsFailure)
        {
            return Result.Failure<RepairEquipmentPhotoResponse>(processResult.Error!);
        }

        var processed = processResult.Value!;
        var photoId = Guid.NewGuid();
        var safeSerial = Uri.EscapeDataString(equipment.SerialNumber.Trim().Replace("/", "-"));
        var stageStr = command.Stage.ToString();
        var s3Key = $"tenants/{command.TenantId:N}/batches/{equipment.BatchId:N}/equipments/{safeSerial}/{stageStr}_{photoId:N}.webp";

        // Subir a Backblaze B2 (bucket público para carga veloz en taller y portal B2B)
        string publicUrl;
        using (var webpStream = new MemoryStream(processed.WebpBytes))
        {
            publicUrl = await _storageService.UploadPublicAsync(
                s3Key,
                webpStream,
                processed.ContentType,
                ct).ConfigureAwait(false);
        }

        // Agregar foto al Aggregate Root aplicando invariantes DDD
        var addResult = equipment.AddPhoto(
            photoId: photoId,
            stage: command.Stage,
            s3Bucket: _storageService.PublicBucket,
            s3Key: s3Key,
            fileName: $"{Path.GetFileNameWithoutExtension(command.FileName)}.webp",
            fileSizeBytes: processed.WebpBytes.Length,
            contentType: processed.ContentType,
            caption: command.Caption,
            uploadedBy: command.UploadedBy,
            capturedAt: DateTimeOffset.UtcNow);

        if (addResult.IsFailure)
        {
            // Limpieza en caso de error en invariante
            await _storageService.DeleteAsync(_storageService.PublicBucket, s3Key, ct).ConfigureAwait(false);
            return Result.Failure<RepairEquipmentPhotoResponse>(addResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var photo = addResult.Value!;
        return Result.Success(new RepairEquipmentPhotoResponse(
            Id: photo.Id,
            EquipmentId: photo.EquipmentId,
            Stage: photo.Stage,
            S3Bucket: photo.S3Bucket,
            S3Key: photo.S3Key,
            FileName: photo.FileName,
            ContentType: photo.ContentType,
            FileSizeBytes: photo.FileSizeBytes,
            Caption: photo.Caption,
            CapturedAt: photo.CapturedAt,
            DownloadUrl: publicUrl));
    }
}
