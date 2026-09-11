using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.UploadRepairEquipmentPhoto;

public sealed record UploadRepairEquipmentPhotoCommand(
    Guid TenantId,
    Guid EquipmentId,
    Stream Content,
    string FileName,
    string ContentType,
    PhotoStage Stage,
    string? Caption = null,
    Guid? UploadedBy = null) : ICommand<RepairEquipmentPhotoResponse>;
