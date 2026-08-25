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
    private readonly ICategoryRepository _categories;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCatalogItemHandler(
        IValidator<CreateCatalogItemCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICategoryRepository categories,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _categories = categories;
        _items = items;
        _settings = settings;
        _unitOfWork = unitOfWork;
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
        if (command.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<CreateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            schemaJson = category.AttributeSchemaJson;
        }

        if (!string.IsNullOrWhiteSpace(command.Sku)
            && await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.Sku, null, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemResponse>(
                new Error("catalog.item.sku.duplicate", "Ya existe un ítem con el mismo SKU.", ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var created = CatalogItem.Create(
            id,
            command.TenantId,
            command.Kind,
            command.Name,
            command.Description,
            command.Sku,
            command.BasePrice,
            command.CategoryId,
            command.CustomAttributesJson,
            schemaJson);
        if (created.IsFailure)
        {
            return Result.Failure<CreateCatalogItemResponse>(created.Error!);
        }

        await _items.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateCatalogItemResponse(created.Value!.Id, created.Value.TenantId));
    }
}
