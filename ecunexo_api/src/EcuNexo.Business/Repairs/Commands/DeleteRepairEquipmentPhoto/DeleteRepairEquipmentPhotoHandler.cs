using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Repairs.Commands.DeleteRepairEquipmentPhoto;

public sealed class DeleteRepairEquipmentPhotoHandler : ICommandHandler<DeleteRepairEquipmentPhotoCommand, DeleteRepairEquipmentPhotoResponse>
{
    private readonly IRepairEquipmentRepository _equipmentRepo;
    private readonly IStorageService _storageService;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteRepairEquipmentPhotoHandler(
        IRepairEquipmentRepository equipmentRepo,
        IStorageService storageService,
        IUnitOfWork unitOfWork)
    {
        _equipmentRepo = equipmentRepo;
        _storageService = storageService;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteRepairEquipmentPhotoResponse>> Handle(
        DeleteRepairEquipmentPhotoCommand command,
        CancellationToken ct)
    {
        var equipment = await _equipmentRepo.GetTrackedAsync(command.TenantId, command.EquipmentId, ct).ConfigureAwait(false);
        if (equipment == null)
        {
            return Result.Failure<DeleteRepairEquipmentPhotoResponse>(new Error(
                "repairs.equipment.not_found",
                "El equipo no fue encontrado o no pertenece a este tenant.",
                ErrorType.NotFound));
        }

        var removeResult = equipment.RemovePhoto(command.PhotoId, command.RemovedBy);
        if (removeResult.IsFailure)
        {
            return Result.Failure<DeleteRepairEquipmentPhotoResponse>(removeResult.Error!);
        }

        var removedPhoto = removeResult.Value!;

        // Eliminar objeto de Backblaze B2
        try
        {
            await _storageService.DeleteAsync(removedPhoto.S3Bucket, removedPhoto.S3Key, ct).ConfigureAwait(false);
        }
        catch
        {
            // Ignorar fallo en almacenamiento para garantizar consistencia en base de datos
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new DeleteRepairEquipmentPhotoResponse(command.PhotoId, command.EquipmentId));
    }
}
