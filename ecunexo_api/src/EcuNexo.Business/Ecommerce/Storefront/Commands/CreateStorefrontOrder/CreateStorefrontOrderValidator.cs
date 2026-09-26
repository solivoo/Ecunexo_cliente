using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

public sealed class CreateStorefrontOrderValidator : AbstractValidator<CreateStorefrontOrderCommand>
{
    public const int RequestIdMaxLength = 100;
    public const int ItemsMaxCount = 20;
    public const int ItemQuantityMin = 1;
    public const int ItemQuantityMax = 10;
    public const int NotesMaxLength = 1000;
    public const int MinFormElapsedMs = 2000;
    public const string InvalidFormErrorCode = "ecommerce.checkout.invalid_form";

    public CreateStorefrontOrderValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("El tenant es obligatorio.");

        RuleFor(x => x.Website)
            .Must(website => string.IsNullOrWhiteSpace(website))
            .WithMessage("No podemos procesar este pedido.")
            .WithErrorCode(InvalidFormErrorCode);

        RuleFor(x => x.FormElapsedMs)
            .Must(elapsed => !elapsed.HasValue || elapsed.Value >= MinFormElapsedMs)
            .WithMessage("No podemos procesar este pedido.")
            .WithErrorCode(InvalidFormErrorCode);

        RuleFor(x => x.RequestId)
            .NotEmpty()
            .MaximumLength(RequestIdMaxLength)
            .WithMessage($"El identificador de la solicitud es obligatorio y no puede superar {RequestIdMaxLength} caracteres.");

        RuleFor(x => x.Customer)
            .NotNull()
            .WithMessage("Los datos del cliente son obligatorios.");

        RuleFor(x => x.Customer.Name)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("El nombre del cliente es obligatorio.");

        RuleFor(x => x.Customer.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(200)
            .WithMessage("El correo electrónico del cliente es inválido.");

        RuleFor(x => x.Customer.Phone)
            .NotEmpty()
            .Matches(@"^\+?[0-9][0-9\s\-()]{6,49}$")
            .WithMessage("El teléfono del cliente es inválido.");

        RuleFor(x => x.Customer.TaxId)
            .MaximumLength(20)
            .Matches(@"^([0-9]{10}|[0-9]{13})$")
            .When(x => !string.IsNullOrWhiteSpace(x.Customer?.TaxId))
            .WithMessage("La identificación del cliente debe tener 10 o 13 dígitos.");

        RuleFor(x => x.Shipping)
            .NotNull()
            .WithMessage("Los datos de envío son obligatorios.");

        RuleFor(x => x.Shipping.Address)
            .NotEmpty()
            .MaximumLength(300)
            .WithMessage("La dirección de entrega es obligatoria.");

        RuleFor(x => x.Shipping.City)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("La ciudad de entrega es obligatoria.");

        RuleFor(x => x.Shipping.Reference)
            .MaximumLength(300)
            .WithMessage("La referencia de entrega no puede superar 300 caracteres.");

        RuleFor(x => x.PaymentMethod)
            .NotEmpty()
            .Must(code => EcommerceStorefrontSettingsReader.TryParsePaymentMethod(code, out _))
            .WithMessage("El método de pago no es válido.");

        RuleFor(x => x.ShippingMethod)
            .NotEmpty()
            .Must(code => EcommerceStorefrontSettingsReader.TryParseShippingMethod(code, out _))
            .WithMessage("El método de envío no es válido.");

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("El pedido debe contener al menos un producto.");

        RuleFor(x => x.Items)
            .Must(items => items is null || items.Count <= ItemsMaxCount)
            .WithMessage($"El pedido no puede tener más de {ItemsMaxCount} productos.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.CatalogItemId)
                .NotEmpty()
                .WithMessage("El producto del catálogo es obligatorio.");

            item.RuleFor(i => i.Quantity)
                .InclusiveBetween(ItemQuantityMin, ItemQuantityMax)
                .WithMessage($"La cantidad debe estar entre {ItemQuantityMin} y {ItemQuantityMax}.");
        });

        RuleFor(x => x.Notes)
            .MaximumLength(NotesMaxLength)
            .WithMessage($"Las notas del pedido no pueden superar {NotesMaxLength} caracteres.");
    }
}
