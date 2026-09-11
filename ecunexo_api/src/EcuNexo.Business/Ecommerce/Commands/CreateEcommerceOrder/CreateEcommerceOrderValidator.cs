using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;

public sealed class CreateEcommerceOrderValidator : AbstractValidator<CreateEcommerceOrderCommand>
{
    public CreateEcommerceOrderValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty().WithMessage("El tenant es obligatorio.");
        RuleFor(x => x.WarehouseId).NotEmpty().WithMessage("La bodega de despacho es obligatoria.");
        RuleFor(x => x.Customer).NotNull().WithMessage("Los datos del cliente son obligatorios.");
        RuleFor(x => x.Customer.CustomerName).NotEmpty().WithMessage("El nombre o razón social del cliente es obligatorio.");
        RuleFor(x => x.Customer.TaxId).NotEmpty().WithMessage("La identificación tributaria del cliente es obligatoria.");
        RuleFor(x => x.Customer.Email).NotEmpty().EmailAddress().WithMessage("El correo electrónico del cliente es inválido.");
        RuleFor(x => x.Shipping).NotNull().WithMessage("Los datos de entrega son obligatorios.");
        RuleFor(x => x.Shipping.RecipientName).NotEmpty().WithMessage("El nombre del destinatario es obligatorio.");
        RuleFor(x => x.Shipping.AddressLine1).NotEmpty().WithMessage("La dirección de entrega es obligatoria.");
        RuleFor(x => x.Shipping.City).NotEmpty().WithMessage("La ciudad de entrega es obligatoria.");
        RuleFor(x => x.Items).NotEmpty().WithMessage("La orden debe contener al menos un producto.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.CatalogItemId).NotEmpty().WithMessage("El producto del catálogo es obligatorio.");
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("La cantidad del ítem debe ser mayor a cero.");
            item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("El precio unitario no puede ser negativo.");
            item.RuleFor(i => i.DiscountAmount).GreaterThanOrEqualTo(0).WithMessage("El descuento no puede ser negativo.");
        });
    }
}
