using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItem;

public sealed class CreateCatalogItemHandler : ICommandHandler<CreateCatalogItemCommand, CreateCatalogItemResponse>
{
    private readonly IValidator<CreateCatalogItemCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IProductTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICategoryRepository? _categories;

    public CreateCatalogItemHandler(
        IValidator<CreateCatalogItemCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IProductTemplateRepository templates,
        IUnitOfWork unitOfWork,
        ICategoryRepository? categories = null)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _items = items;
        _settings = settings;
        _templates = templates;
        _unitOfWork = unitOfWork;
        _categories = categories;
    }

    public async Task<Result<CreateCatalogItemResponse>> Handle(
        CreateCatalogItemCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateCatalogItemResponse>(
                new Error("catalog.item.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemResponse>(
                new Error("catalog.item.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var kindAllowed = await AllowedCatalogItemKinds
            .EnsureAllowedAsync(_settings, command.TenantId, command.Kind, ct)
            .ConfigureAwait(false);
        if (kindAllowed.IsFailure)
        {
            return Result.Failure<CreateCatalogItemResponse>(kindAllowed.Error!);
        }

        var schemaJson = CatalogAttributeSchema.EmptyArrayJson;
        string? categoryName = null;
        if (command.CategoryId is { } categoryId)
        {
            if (_categories is null)
            {
                return Result.Failure<CreateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            var category = await _categories
                .GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<CreateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            categoryName = category.Name;
        }

        if (command.FamilyId is { } familyId)
        {
            var family = await _templates.GetByIdAsync(familyId, command.TenantId, ct).ConfigureAwait(false);
            if (family is null)
            {
                return Result.Failure<CreateCatalogItemResponse>(
                    new Error("catalog.item.family.not_found", "El arquetipo (familia) no existe.", ErrorType.NotFound));
            }
        }

        if (!string.IsNullOrWhiteSpace(command.Sku)
            && await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.Sku, null, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemResponse>(
                new Error("catalog.item.sku.duplicate", "Ya existe un ítem con el mismo SKU.", ErrorType.Conflict));
        }

        if (!string.IsNullOrWhiteSpace(command.Barcode)
            && await _items.BarcodeExistsIgnoreCaseAsync(command.TenantId, command.Barcode, null, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemResponse>(
                new Error("catalog.item.barcode.duplicate", "Ya existe un ítem con el mismo código de barras.", ErrorType.Conflict));
        }

        var syncedHierarchyPathJson = CatalogItem.SyncCategoryInHierarchyPath(
            command.HierarchyPathJson,
            categoryName);

        var id = _idGenerator.NewId();
        var created = CatalogItem.Create(
            id,
            command.TenantId,
            command.Kind,
            command.Name,
            command.Description,
            command.Sku,
            command.BasePrice,
            command.CustomAttributesJson,
            schemaJson,
            command.FamilyId,
            syncedHierarchyPathJson,
            command.Barcode,
            command.MinOrderQuantity,
            command.CostPrice,
            command.CategoryId);
        if (created.IsFailure)
        {
            return Result.Failure<CreateCatalogItemResponse>(created.Error!);
        }

        await _items.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateCatalogItemResponse(created.Value!.Id, created.Value.TenantId));
    }
}
