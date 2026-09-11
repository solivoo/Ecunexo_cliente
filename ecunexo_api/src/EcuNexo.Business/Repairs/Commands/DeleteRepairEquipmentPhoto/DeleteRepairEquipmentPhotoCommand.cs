using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Repairs.Commands.DeleteRepairEquipmentPhoto;

public sealed record DeleteRepairEquipmentPhotoCommand(
    Guid TenantId,
    Guid EquipmentId,
    Guid PhotoId,
    Guid? RemovedBy = null) : ICommand<DeleteRepairEquipmentPhotoResponse>;

public sealed record DeleteRepairEquipmentPhotoResponse(Guid PhotoId, Guid EquipmentId);
