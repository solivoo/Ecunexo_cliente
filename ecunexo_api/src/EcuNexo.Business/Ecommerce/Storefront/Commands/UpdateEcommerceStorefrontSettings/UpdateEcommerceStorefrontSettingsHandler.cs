using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Platform;
using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.UpdateEcommerceStorefrontSettings;

public sealed class UpdateEcommerceStorefrontSettingsHandler
    : ICommandHandler<UpdateEcommerceStorefrontSettingsCommand, EcommerceStorefrontSettingsDto>
{
    private readonly IValidator<UpdateEcommerceStorefrontSettingsCommand> _validator;
    private readonly ISysSettingRepository _settings;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateEcommerceStorefrontSettingsHandler(
        IValidator<UpdateEcommerceStorefrontSettingsCommand> validator,
        ISysSettingRepository settings,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _settings = settings;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<EcommerceStorefrontSettingsDto>> Handle(
        UpdateEcommerceStorefrontSettingsCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<EcommerceStorefrontSettingsDto>(
                new Error("ecommerce.storefront.settings.validation", message, ErrorType.Validation));
        }

        var paymentMethods = new List<EcommercePaymentMethod>();
        foreach (var code in command.PaymentMethods)
        {
            if (EcommerceStorefrontSettingsReader.TryParsePaymentMethod(code, out var method)
                && !paymentMethods.Contains(method))
            {
                paymentMethods.Add(method);
            }
        }

        var shippingOptions = new List<ShippingMethodOption>();
        foreach (var input in command.ShippingMethods)
        {
            if (EcommerceStorefrontSettingsReader.TryParseShippingMethod(input.Code, out var method)
                && !shippingOptions.Exists(option => option.Method == method))
            {
                shippingOptions.Add(new ShippingMethodOption(method, Math.Max(0m, input.Cost)));
            }
        }

        var instructions = command.BankTransferInstructions?.Trim() ?? string.Empty;
        var holdHours = Math.Clamp(
            command.PaymentHoldHours,
            EcommerceStorefrontSettingsReader.MinPaymentHoldHours,
            EcommerceStorefrontSettingsReader.MaxPaymentHoldHours);
        var contactWhatsapp = EcommerceContactNormalizer.NormalizeWhatsapp(command.ContactWhatsapp);
        var ordersNotificationEmail = EcommerceContactNormalizer.NormalizeEmail(command.OrdersNotificationEmail);
        var maxPendingOrders = Math.Clamp(
            command.MaxPendingOrders,
            EcommerceStorefrontSettingsReader.MinMaxPendingOrders,
            EcommerceStorefrontSettingsReader.MaxMaxPendingOrders);
        var maintenanceMessage = (command.MaintenanceMessage?.Trim() ?? string.Empty);
        if (maintenanceMessage.Length > EcommerceStorefrontSettingsReader.MaintenanceMessageMaxLength)
        {
            maintenanceMessage = maintenanceMessage[..EcommerceStorefrontSettingsReader.MaintenanceMessageMaxLength];
        }

        var minOrderAmount = Math.Round(
            Math.Clamp(
                command.MinOrderAmount,
                EcommerceStorefrontSettingsReader.MinMinOrderAmount,
                EcommerceStorefrontSettingsReader.MaxMinOrderAmount),
            2,
            MidpointRounding.AwayFromZero);

        var scopeId = command.TenantId.ToString("D");
        var payloads = new (string Code, string Json)[]
        {
            (
                EcommerceSettingCodes.StorefrontPaymentMethods,
                JsonSerializer.Serialize(paymentMethods.Select(method => method.ToString()))),
            (
                EcommerceSettingCodes.StorefrontShippingMethods,
                JsonSerializer.Serialize(shippingOptions.Select(option => new
                {
                    code = option.Method.ToString(),
                    cost = option.Cost,
                }))),
            (
                EcommerceSettingCodes.StorefrontBankTransferInstructions,
                JsonSerializer.Serialize(instructions)),
            (
                EcommerceSettingCodes.StorefrontPaymentHoldHours,
                JsonSerializer.Serialize(holdHours)),
            (
                EcommerceSettingCodes.StorefrontReserveOnOrder,
                JsonSerializer.Serialize(command.ReserveOnOrder)),
            (
                EcommerceSettingCodes.StorefrontContactWhatsapp,
                JsonSerializer.Serialize(contactWhatsapp)),
            (
                EcommerceSettingCodes.StorefrontOrdersNotificationEmail,
                JsonSerializer.Serialize(ordersNotificationEmail)),
            (
                EcommerceSettingCodes.StorefrontMaxPendingOrders,
                JsonSerializer.Serialize(maxPendingOrders)),
            (
                EcommerceSettingCodes.StorefrontMaintenanceEnabled,
                JsonSerializer.Serialize(command.MaintenanceEnabled)),
            (
                EcommerceSettingCodes.StorefrontMaintenanceMessage,
                JsonSerializer.Serialize(maintenanceMessage)),
            (
                EcommerceSettingCodes.StorefrontMinOrderAmount,
                JsonSerializer.Serialize(minOrderAmount)),
        };

        foreach (var (code, json) in payloads)
        {
            var upsert = await UpsertAsync(code, json, scopeId, command.UpdatedBy, ct).ConfigureAwait(false);
            if (upsert.IsFailure)
            {
                return Result.Failure<EcommerceStorefrontSettingsDto>(upsert.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new EcommerceStorefrontSettingsDto(
            paymentMethods.Select(method => method.ToString()).ToList(),
            shippingOptions
                .Select(option => new StorefrontShippingMethodSettingDto(option.Method.ToString(), option.Cost))
                .ToList(),
            instructions,
            holdHours,
            command.ReserveOnOrder,
            contactWhatsapp,
            ordersNotificationEmail,
            maxPendingOrders,
            command.MaintenanceEnabled,
            maintenanceMessage,
            minOrderAmount));
    }

    private async Task<Result> UpsertAsync(
        string code,
        string valueJson,
        string scopeId,
        Guid? updatedBy,
        CancellationToken ct)
    {
        var existing = await _settings
            .GetAsync(code, SettingScope.Tenant, scopeId, ct)
            .ConfigureAwait(false);

        if (existing is null)
        {
            var created = SysSetting.Create(_idGenerator.NewId(), code, valueJson, SettingScope.Tenant, scopeId);
            if (created.IsFailure)
            {
                return Result.Failure(created.Error!);
            }

            await _settings.AddAsync(created.Value!, ct).ConfigureAwait(false);
            return Result.Success();
        }

        return existing.SetValue(valueJson, updatedBy);
    }
}
