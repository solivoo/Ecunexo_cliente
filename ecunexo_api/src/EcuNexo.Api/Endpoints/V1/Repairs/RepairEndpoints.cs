using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Repairs;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Commands.CreateRepairDispatch;
using EcuNexo.Business.Repairs.Commands.ImportRepairBatch;
using EcuNexo.Business.Repairs.Commands.UpdateEquipmentStatus;
using EcuNexo.Business.Repairs.Excel;
using EcuNexo.Business.Repairs.Queries.ListBatches;
using EcuNexo.Business.Repairs.Queries.VerifyDispatchPublic;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Business.Repairs.Storage;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Repairs;

public static class RepairEndpoints
{
    public static WebApplication MapRepairEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder repairsGroup = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/repairs")
            .WithApiVersionSet(versionSet)
            .WithTags("Repairs")
            .RequireAuthorization();

        // 0. Clientes Corporativos (Whirlpool, Mabe, etc.)
        repairsGroup.MapGet("/customers", ListCustomersAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        repairsGroup.MapPost("/customers", CreateCustomerAsync)
            .AddEndpointFilter(PermissionFilters.Require("repairs.batches.import"));

        // 1. Lotes (Batches)
        repairsGroup.MapGet("/batches", ListBatchesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        repairsGroup.MapGet("/batches/{batchId:guid}", GetBatchByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        repairsGroup.MapPost("/batches/import", ImportBatchAsync)
            .DisableAntiforgery()
            .AddEndpointFilter(PermissionFilters.Require("repairs.batches.import"));

        repairsGroup.MapGet("/batches/{batchId:guid}/equipments", ListBatchEquipmentsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        // 2. Plantillas Excel
        repairsGroup.MapGet("/templates", ListTemplatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        repairsGroup.MapGet("/templates/download-default-excel", DownloadDefaultTemplateExcelAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.batches.import", "repairs.b2b_portal.view"));

        repairsGroup.MapGet("/templates/{templateId:guid}/download-excel", DownloadTemplateExcelAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.batches.import", "repairs.b2b_portal.view"));

        // 3. Equipos y Estados
        repairsGroup.MapPatch("/equipments/{equipmentId:guid}/status", UpdateEquipmentStatusAsync)
            .AddEndpointFilter(PermissionFilters.Require("repairs.equipments.update_status"));

        // 4. Fotos de Evidencia en Amazon S3
        repairsGroup.MapPost("/equipments/{equipmentId:guid}/photos/presigned-upload", GeneratePhotoUploadUrlAsync)
            .AddEndpointFilter(PermissionFilters.Require("repairs.equipments.update_status"));

        repairsGroup.MapPost("/equipments/{equipmentId:guid}/photos/confirm", ConfirmPhotoUploadAsync)
            .AddEndpointFilter(PermissionFilters.Require("repairs.equipments.update_status"));

        repairsGroup.MapGet("/equipments/{equipmentId:guid}/photos", ListEquipmentPhotosAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.batches.read", "repairs.b2b_portal.view"));

        // 5. Despachos
        repairsGroup.MapPost("/dispatches", CreateDispatchAsync)
            .AddEndpointFilter(PermissionFilters.Require("repairs.dispatches.create"));

        repairsGroup.MapGet("/dispatches", ListDispatchesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.dispatches.read", "repairs.b2b_portal.view"));

        repairsGroup.MapGet("/dispatches/{dispatchId:guid}", GetDispatchByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("repairs.dispatches.read", "repairs.b2b_portal.view"));

        // 6. Validación Pública QR (Sin Autenticación)
        RouteGroupBuilder publicGroup = app
            .MapGroup("/api/v{version:apiVersion}/public/repairs")
            .WithApiVersionSet(versionSet)
            .WithTags("Repairs Public")
            .AllowAnonymous();

        publicGroup.MapGet("/verify-dispatch/{verificationHash}", VerifyDispatchPublicAsync);

        return app;
    }

    private static async Task<IResult> ListBatchesAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] Guid? customerId,
        [FromQuery] RepairBatchStatus? status,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender.AskAsync<ListBatchesQuery, IReadOnlyList<BatchListItemResponse>>(
            new ListBatchesQuery(tenantId, customerId, status), ct).ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ImportBatchAsync(
        [FromRoute] Guid tenantId,
        [FromForm] Guid customerId,
        [FromForm] string batchNumber,
        [FromForm] Guid? templateId,
        [FromForm] decimal? rateN1,
        [FromForm] decimal? rateN2,
        [FromForm] decimal? rateN3,
        [FromForm] string? contractReference,
        IFormFile? file,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return Result.Failure<ImportRepairBatchResponse>(
                new Error("repairs.import.file_empty", "Debe adjuntar un archivo Excel válido.", ErrorType.Validation)).ToHttpResult();
        }

        await using var stream = file.OpenReadStream();
        var command = new ImportRepairBatchCommand(
            TenantId: tenantId,
            CustomerId: customerId,
            BatchNumber: batchNumber,
            TemplateId: templateId,
            AgreedRateN1: rateN1,
            AgreedRateN2: rateN2,
            AgreedRateN3: rateN3,
            ContractReference: contractReference,
            ExpectedCompletionAt: null,
            ExcelStream: stream,
            CreatedBy: caller.UserId);

        var result = await sender.SendAsync<ImportRepairBatchCommand, ImportRepairBatchResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListBatchEquipmentsAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid batchId,
        [FromQuery] RepairEquipmentStatus? status,
        [FromServices] IRepairEquipmentRepository equipmentRepo,
        CancellationToken ct)
    {
        var equipments = await equipmentRepo.ListByBatchAsync(tenantId, batchId, status, ct).ConfigureAwait(false);
        return Results.Ok(equipments);
    }

    private static async Task<IResult> DownloadTemplateExcelAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid templateId,
        [FromServices] IRepairBatchTemplateRepository templateRepo,
        [FromServices] IRepairBatchExcelService excelService,
        CancellationToken ct)
    {
        var template = await templateRepo.GetByIdAsync(tenantId, templateId, ct).ConfigureAwait(false);
        if (template == null)
        {
            return Results.NotFound(new { message = "Plantilla no encontrada." });
        }

        var bytes = excelService.GenerateTemplateWorkbook(template);
        var fileName = $"Plantilla_Lote_{template.Name.Replace(" ", "_")}.xlsx";
        return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> UpdateEquipmentStatusAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid equipmentId,
        [FromBody] UpdateEquipmentStatusRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new UpdateEquipmentStatusCommand(
            TenantId: tenantId,
            EquipmentId: equipmentId,
            TargetStatus: request.TargetStatus,
            TechnicianId: request.TechnicianId,
            Notes: request.Notes,
            ConfirmedDamageLevel: request.ConfirmedDamageLevel,
            ServiceFee: request.ServiceFee,
            ModifiedBy: caller.UserId);

        var result = await sender.SendAsync<UpdateEquipmentStatusCommand, UpdateEquipmentStatusResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GeneratePhotoUploadUrlAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid equipmentId,
        [FromBody] GeneratePhotoUploadUrlRequest request,
        [FromServices] IRepairEquipmentRepository equipmentRepo,
        [FromServices] IAwsS3StorageService storageService,
        CancellationToken ct)
    {
        var eq = await equipmentRepo.GetByIdAsync(tenantId, equipmentId, ct).ConfigureAwait(false);
        if (eq == null)
        {
            return Results.NotFound(new { message = "Equipo no encontrado." });
        }

        var presigned = storageService.GeneratePresignedUploadUrl(
            tenantId,
            eq.BatchId,
            eq.SerialNumber,
            request.Stage,
            request.FileName,
            request.ContentType ?? "image/webp");

        return Results.Ok(presigned);
    }

    private static async Task<IResult> ConfirmPhotoUploadAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid equipmentId,
        [FromBody] ConfirmPhotoUploadRequest request,
        [FromServices] IRepairEquipmentRepository equipmentRepo,
        [FromServices] IUnitOfWork unitOfWork,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var photoResult = RepairEquipmentPhoto.Create(
            Guid.NewGuid(),
            equipmentId,
            request.Stage,
            request.S3Bucket,
            request.S3Key,
            request.FileName,
            request.FileSizeBytes,
            request.ContentType,
            request.Caption,
            caller.UserId);

        if (photoResult.IsFailure)
        {
            return photoResult.ToHttpResult();
        }

        await equipmentRepo.AddPhotoAsync(photoResult.Value!, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Ok(photoResult.Value);
    }

    private static async Task<IResult> ListEquipmentPhotosAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid equipmentId,
        [FromServices] IRepairEquipmentRepository equipmentRepo,
        [FromServices] IAwsS3StorageService storageService,
        CancellationToken ct)
    {
        var photos = await equipmentRepo.ListPhotosAsync(equipmentId, ct).ConfigureAwait(false);
        var photosWithUrls = photos.Select(p => new
        {
            p.Id,
            p.EquipmentId,
            p.Stage,
            p.FileName,
            p.Caption,
            p.CapturedAt,
            DownloadUrl = storageService.GeneratePresignedDownloadUrl(p.S3Bucket, p.S3Key).DownloadUrl
        }).ToList();

        return Results.Ok(photosWithUrls);
    }

    private static async Task<IResult> CreateDispatchAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateRepairDispatchRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new CreateRepairDispatchCommand(
            TenantId: tenantId,
            BatchId: request.BatchId,
            DispatchNumber: request.DispatchNumber,
            EquipmentIds: request.EquipmentIds,
            CarrierName: request.CarrierName,
            CarrierDocument: request.CarrierDocument,
            CarrierVehiclePlate: request.CarrierVehiclePlate,
            Notes: request.Notes,
            CreatedBy: caller.UserId);

        var result = await sender.SendAsync<CreateRepairDispatchCommand, CreateRepairDispatchResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListDispatchesAsync(
        [FromRoute] Guid tenantId,
        [FromServices] IRepairDispatchRepository dispatchRepo,
        CancellationToken ct)
    {
        var dispatches = await dispatchRepo.ListByTenantAsync(tenantId, ct).ConfigureAwait(false);
        return Results.Ok(dispatches);
    }

    private static async Task<IResult> VerifyDispatchPublicAsync(
        [FromRoute] string verificationHash,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender.AskAsync<VerifyDispatchPublicQuery, PublicDispatchVerificationResponse>(
            new VerifyDispatchPublicQuery(verificationHash), ct).ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ListCustomersAsync(
        [FromRoute] Guid tenantId,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] IUnitOfWork unitOfWork,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var customers = await customerRepo.ListByTenantAsync(tenantId, ct).ConfigureAwait(false);
        if (customers.Count == 0)
        {
            var seed = Customer.Create(
                Guid.NewGuid(),
                tenantId,
                "Whirlpool del Ecuador S.A.",
                "1791234567001",
                "servicio.b2b@whirlpool.com",
                "+593 2 398 5000",
                "Av. República de El Salvador y Naciones Unidas, Quito",
                "Auditoría Whirlpool B2B",
                "Contrato corporativo de servicio técnico y reacondicionamiento");

            if (seed.IsSuccess)
            {
                await customerRepo.AddAsync(seed.Value!, ct).ConfigureAwait(false);
                await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
                customers = [seed.Value!];
            }
        }

        return Results.Ok(customers);
    }

    private static async Task<IResult> CreateCustomerAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateCustomerRequest request,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] IUnitOfWork unitOfWork,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var customerResult = Customer.Create(
            Guid.NewGuid(),
            tenantId,
            request.Name,
            request.TaxId,
            request.ContactEmail,
            request.ContactPhone,
            request.Address,
            request.ContactPerson,
            request.Notes);

        if (customerResult.IsFailure)
        {
            return customerResult.ToHttpResult();
        }

        await customerRepo.AddAsync(customerResult.Value!, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Ok(customerResult.Value);
    }

    private static async Task<IResult> GetBatchByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid batchId,
        [FromServices] IRepairBatchRepository batchRepo,
        CancellationToken ct)
    {
        var batch = await batchRepo.GetByIdAsync(tenantId, batchId, ct).ConfigureAwait(false);
        if (batch == null)
        {
            return Results.NotFound(new { message = "Lote no encontrado." });
        }

        var progress = batch.TotalCount > 0
            ? Math.Round((double)(batch.DispatchedCount + batch.ReadyCount) / batch.TotalCount * 100, 1)
            : 0.0;

        return Results.Ok(new
        {
            batch.Id,
            batch.BatchNumber,
            batch.CustomerId,
            CustomerName = batch.Customer?.Name ?? "Sin Asignar",
            CustomerTaxId = batch.Customer?.TaxId,
            batch.Status,
            batch.AgreedRateN1,
            batch.AgreedRateN2,
            batch.AgreedRateN3,
            batch.ContractReference,
            batch.TotalCount,
            batch.ReceivedCount,
            batch.InRepairCount,
            batch.ReadyCount,
            batch.DispatchedCount,
            ProgressPercentage = progress,
            batch.ReceivedAt,
            batch.ExpectedCompletionAt
        });
    }

    private static async Task<IResult> ListTemplatesAsync(
        [FromRoute] Guid tenantId,
        [FromServices] IRepairBatchTemplateRepository templateRepo,
        CancellationToken ct)
    {
        var templates = await templateRepo.ListByTenantAsync(tenantId, ct).ConfigureAwait(false);
        return Results.Ok(templates);
    }

    private static async Task<IResult> DownloadDefaultTemplateExcelAsync(
        [FromRoute] Guid tenantId,
        [FromServices] IRepairBatchTemplateRepository templateRepo,
        [FromServices] IRepairBatchExcelService excelService,
        [FromServices] IUnitOfWork unitOfWork,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var template = await templateRepo.GetDefaultOrActiveForCustomerAsync(tenantId, null, ct).ConfigureAwait(false);
        if (template == null)
        {
            var json = RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson();
            var created = RepairBatchTemplate.Create(
                Guid.NewGuid(),
                tenantId,
                "Plantilla Estándar Whirlpool",
                json,
                null);

            if (created.IsSuccess)
            {
                await templateRepo.AddAsync(created.Value!, ct).ConfigureAwait(false);
                await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
                template = created.Value;
            }
        }

        if (template == null)
        {
            return Results.Problem("No se pudo generar la plantilla.");
        }

        var bytes = excelService.GenerateTemplateWorkbook(template);
        var fileName = "Plantilla_Lote_Equipos_Taller.xlsx";
        return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> GetDispatchByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid dispatchId,
        [FromServices] IRepairDispatchRepository dispatchRepo,
        CancellationToken ct)
    {
        var dispatch = await dispatchRepo.GetByIdAsync(tenantId, dispatchId, ct).ConfigureAwait(false);
        if (dispatch == null)
        {
            return Results.NotFound(new { message = "Despacho no encontrado." });
        }

        return Results.Ok(dispatch);
    }
}
