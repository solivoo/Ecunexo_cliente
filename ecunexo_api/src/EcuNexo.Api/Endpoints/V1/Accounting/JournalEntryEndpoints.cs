using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Accounting;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting;
using EcuNexo.Business.Accounting.Commands.CreateJournalEntry;
using EcuNexo.Business.Accounting.Commands.GeneratePurchaseJournalEntry;
using EcuNexo.Business.Accounting.Queries.GetJournalEntryById;
using EcuNexo.Business.Accounting.Queries.ListJournalEntries;
using EcuNexo.Core.Accounting;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Accounting;

public static class JournalEntryEndpoints
{
    public static WebApplication MapJournalEntryEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/accounting/journal-entries")
            .WithApiVersionSet(versionSet)
            .WithTags("Accounting - Journal Entries")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.asientos.read",
                "contabilidad.read"));

        group.MapGet("/{id:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.asientos.read",
                "contabilidad.read"));

        group.MapPost("/", CreateManualAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.asientos.manage",
                "contabilidad.asientos.read"));

        group.MapPost("/generate-from-purchase/{purchaseId:guid}", GenerateFromPurchaseAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.asientos.manage",
                "contabilidad.asientos.read",
                "purchases.purchases.read",
                "purchases.purchases.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? status,
        [FromQuery] int? source,
        [FromQuery] string? search,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        JournalEntryStatus? statusEnum = status.HasValue ? (JournalEntryStatus)status.Value : null;
        JournalEntrySource? sourceEnum = source.HasValue ? (JournalEntrySource)source.Value : null;

        var query = new ListJournalEntriesQuery(
            tenantId,
            from,
            to,
            sourceEnum,
            statusEnum,
            search);

        var result = await sender
            .AskAsync<ListJournalEntriesQuery, ListJournalEntriesResponse>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var query = new GetJournalEntryByIdQuery(tenantId, id);
        var result = await sender
            .AskAsync<GetJournalEntryByIdQuery, JournalEntryResponse>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateManualAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateJournalEntryRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var lines = request.Lines?.Select(l => new CreateJournalEntryLineInput(
            l.AccountId,
            l.Debit,
            l.Credit,
            l.Description)).ToList() ?? [];

        var command = new CreateJournalEntryCommand(
            tenantId,
            request.Date,
            request.Description,
            lines,
            request.AutoPost);

        var result = await sender
            .SendAsync<CreateJournalEntryCommand, JournalEntryResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GenerateFromPurchaseAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid purchaseId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new GeneratePurchaseJournalEntryCommand(tenantId, purchaseId);
        var result = await sender
            .SendAsync<GeneratePurchaseJournalEntryCommand, JournalEntryResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
