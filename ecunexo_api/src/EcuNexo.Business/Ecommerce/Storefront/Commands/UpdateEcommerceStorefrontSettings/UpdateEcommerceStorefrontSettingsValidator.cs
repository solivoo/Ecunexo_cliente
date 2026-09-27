using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.UpdateEcommerceStorefrontSettings;

public sealed class UpdateEcommerceStorefrontSettingsValidator
    : AbstractValidator<UpdateEcommerceStorefrontSettingsCommand>
{
    public const int BankTransferInstructionsMaxLength = 2000;
    public const int ContactWhatsappMaxLength = 20;
    public const int OrdersNotificationEmailMaxLength = 254;

    public UpdateEcommerceStorefrontSettingsValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("El tenant es obligatorio.");

        RuleFor(x => x.PaymentMethods)
            .NotEmpty()
            .WithMessage("Debes habilitar al menos un método de pago.");

        RuleForEach(x => x.PaymentMethods)
            .Must(code => EcommerceStorefrontSettingsReader.TryParsePaymentMethod(code, out _))
            .WithMessage("Uno de los métodos de pago no es un código reconocido.");

        RuleFor(x => x.ShippingMethods)
            .NotEmpty()
            .WithMessage("Debes habilitar al menos un método de envío.");

        RuleForEach(x => x.ShippingMethods).ChildRules(item =>
        {
            item.RuleFor(i => i.Code)
                .Must(code => EcommerceStorefrontSettingsReader.TryParseShippingMethod(code, out _))
                .WithMessage("Uno de los métodos de envío no es un código reconocido.");

            item.RuleFor(i => i.Cost)
                .GreaterThanOrEqualTo(0m)
                .WithMessage("El costo de envío no puede ser negativo.");
        });

        RuleFor(x => x.PaymentHoldHours)
            .InclusiveBetween(
                EcommerceStorefrontSettingsReader.MinPaymentHoldHours,
                EcommerceStorefrontSettingsReader.MaxPaymentHoldHours)
            .WithMessage(
                $"Las horas de retención deben estar entre {EcommerceStorefrontSettingsReader.MinPaymentHoldHours} y {EcommerceStorefrontSettingsReader.MaxPaymentHoldHours}.");

        RuleFor(x => x.BankTransferInstructions)
            .MaximumLength(BankTransferInstructionsMaxLength)
            .WithMessage($"Las instrucciones de transferencia no pueden superar {BankTransferInstructionsMaxLength} caracteres.");

        RuleFor(x => x.ContactWhatsapp)
            .MaximumLength(ContactWhatsappMaxLength)
            .Matches(@"^[0-9+\s]*$")
            .When(x => !string.IsNullOrWhiteSpace(x.ContactWhatsapp))
            .WithMessage(
                $"El WhatsApp de la tienda solo admite dígitos, + y espacios, con máximo {ContactWhatsappMaxLength} caracteres.");

        RuleFor(x => x.OrdersNotificationEmail)
            .MaximumLength(OrdersNotificationEmailMaxLength)
            .WithMessage($"El correo para avisos de pedidos no puede superar {OrdersNotificationEmailMaxLength} caracteres.")
            .EmailAddress()
            .WithMessage("El correo para avisos de pedidos no es un correo válido.")
            .When(x => !string.IsNullOrWhiteSpace(x.OrdersNotificationEmail));
    }
}
