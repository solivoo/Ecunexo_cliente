using System.Text;
using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Billing;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.RemisionGuides.Commands.CreateRemisionGuide;
using EcuNexo.Business.RemisionGuides.Commands.UpdateRemisionGuideStatus;
using EcuNexo.Business.RemisionGuides.Queries.GetRemisionGuideById;
using EcuNexo.Business.RemisionGuides.Queries.ListRemisionGuides;
using EcuNexo.Core.RemisionGuides;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Billing;

public static class RemisionGuideEndpoints
{
    public static WebApplication MapRemisionGuideEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/billing/remision-guides")
            .WithApiVersionSet(versionSet)
            .WithTags("Billing - Remision Guides")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "facturacion.guias.remision.read",
                "facturacion.read"));

        group.MapGet("/{id:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "facturacion.guias.remision.read",
                "facturacion.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "facturacion.guias.remision.create",
                "facturacion.read"));

        group.MapPatch("/{id:guid}/status", UpdateStatusAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "facturacion.guias.remision.create",
                "facturacion.read"));

        group.MapGet("/{id:guid}/xml", GetXmlAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "facturacion.guias.remision.read",
                "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] RemisionGuideStatus? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? search,
        [FromServices] IQueryHandler<ListRemisionGuidesQuery, ListRemisionGuidesResponse> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new ListRemisionGuidesQuery(tenantId, status, from, to, search), ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromServices] IQueryHandler<GetRemisionGuideByIdQuery, RemisionGuideDetailDto> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new GetRemisionGuideByIdQuery(tenantId, id), ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateRemisionGuideApiRequest request,
        [FromServices] ICommandHandler<CreateRemisionGuideCommand, CreateRemisionGuideResponse> handler,
        [FromServices] ICallerContext callerContext,
        CancellationToken ct)
    {
        var items = request.Items?.Select(i => new CreateRemisionGuideItemInput(
            i.ItemCode,
            i.Description,
            i.Quantity,
            i.UnitOfMeasure,
            i.InternalReference)).ToList();

        var command = new CreateRemisionGuideCommand(
            tenantId,
            request.Establishment,
            request.EmissionPoint,
            request.Sequential,
            request.IssueDate,
            request.StartingAddress,
            request.StartDate,
            request.EndDate,
            request.CarrierIdentificationType,
            request.CarrierIdentification,
            request.CarrierName,
            request.LicensePlate,
            request.RecipientIdentificationType,
            request.RecipientIdentification,
            request.RecipientName,
            request.RecipientAddress,
            request.TransferReason,
            request.RouteDescription,
            request.CarrierEmail,
            request.CarrierPhone,
            request.SupportDocumentType,
            request.SupportDocumentNumber,
            request.SupportDocumentAuth,
            request.CustomsDocumentNumber,
            items,
            request.EmitSri,
            callerContext.UserId);

        var result = await handler.Handle(command, ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateStatusAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromBody] UpdateRemisionGuideStatusApiRequest request,
        [FromServices] ICommandHandler<UpdateRemisionGuideStatusCommand, bool> handler,
        [FromServices] ICallerContext callerContext,
        CancellationToken ct)
    {
        var command = new UpdateRemisionGuideStatusCommand(
            tenantId,
            id,
            request.NewStatus,
            request.Reason,
            callerContext.UserId);

        var result = await handler.Handle(command, ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetXmlAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromServices] IQueryHandler<GetRemisionGuideByIdQuery, RemisionGuideDetailDto> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new GetRemisionGuideByIdQuery(tenantId, id), ct);
        if (result.IsFailure || result.Value is null || string.IsNullOrWhiteSpace(result.Value.XmlContent))
        {
            return Results.NotFound(new { error = "El comprobante no cuenta con XML generado." });
        }

        var bytes = Encoding.UTF8.GetBytes(result.Value.XmlContent);
        return Results.File(bytes, "application/xml", $"GuiaRemision_{result.Value.DocumentNumber}.xml");
    }
}
