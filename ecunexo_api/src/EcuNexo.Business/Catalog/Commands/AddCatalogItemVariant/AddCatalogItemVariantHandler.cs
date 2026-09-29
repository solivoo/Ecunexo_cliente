using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;

public sealed class AddCatalogItemVariantHandler
    : ICommandHandler<AddCatalogItemVariantCommand, AddCatalogItemVariantResponse>
{
    private readonly IValidator<AddCatalogItemVariantCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public AddCatalogItemVariantHandler(
        IValidator<AddCatalogItemVariantCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AddCatalogItemVariantResponse>> Handle(
        AddCatalogItemVariantCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.variant.add.validation", message, ErrorType.Validation));
        }

        var parent = await _items.GetTrackedByIdAsync(command.TenantId, command.ParentItemId, ct).ConfigureAwait(false);
        if (parent is null)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.item.parent_not_found", "El producto matriz no existe.", ErrorType.NotFound));
        }

        if (!parent.IsMatrixParent)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.item.not_matrix_parent", "El ítem seleccionado no es un producto matriz.", ErrorType.Validation));
        }

        var variantsAllowed = await CatalogTierLimits
            .EnsureVariantsWithinLimitAsync(_tenants, _items, command.TenantId, 1, ct)
            .ConfigureAwait(false);
        if (variantsAllowed.IsFailure)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(variantsAllowed.Error!);
        }

        if (await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.Sku, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.variant.sku.duplicate", $"El SKU '{command.Sku}' ya existe en el catálogo.", ErrorType.Conflict));
        }

        if (!string.IsNullOrWhiteSpace(command.Barcode)
            && await _items.BarcodeExistsIgnoreCaseAsync(command.TenantId, command.Barcode, null, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.variant.barcode.duplicate", $"El código de barras '{command.Barcode}' ya existe en el catálogo.", ErrorType.Conflict));
        }

        var childId = _idGenerator.NewId();
        var childResult = CatalogItem.CreateVariantChild(
            childId,
            parent,
            command.VariantTitle,
            command.Sku,
            command.BasePrice,
            command.CustomAttributesJson,
            CatalogAttributeSchema.EmptyArrayJson,
            barcode: command.Barcode);

        if (childResult.IsFailure)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(childResult.Error!);
        }

        var child = childResult.Value!;
        child.SetSortOrder(parent.Variants.Count);
        if (parent.Variants.Count == 0 && (string.IsNullOrWhiteSpace(parent.Name) || parent.Name.Equals("Producto", StringComparison.OrdinalIgnoreCase)))
        {
            var parentName = CatalogVariantNameResolver.ResolveFromAttributes(command.CustomAttributesJson)
                ?? command.VariantTitle;
            var renamed = parent.Rename(parentName);
            if (renamed.IsFailure)
            {
                return Result.Failure<AddCatalogItemVariantResponse>(renamed.Error!);
            }
        }

        await _items.AddAsync(child, ct).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new AddCatalogItemVariantResponse(
            child.Id,
            parent.Id,
            child.Sku ?? string.Empty,
            child.Name));
    }
}
