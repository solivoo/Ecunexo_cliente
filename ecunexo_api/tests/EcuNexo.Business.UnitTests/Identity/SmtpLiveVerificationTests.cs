using EcuNexo.Api.Email;
using EcuNexo.Core.Platform;

namespace EcuNexo.Business.UnitTests.Identity;

public class SmtpLiveVerificationTests
{
    [Fact(DisplayName = "Verificación en vivo de envío de correo SMTP con Zoho Mail")]
    public async Task VerifyRealSmtpSendAsync()
    {
        var targetEmail = Environment.GetEnvironmentVariable("LIVE_SMTP_TEST_EMAIL") ?? "ecunexo@ecunexo.com";
        var appPassword = Environment.GetEnvironmentVariable("LIVE_SMTP_TEST_PASSWORD");
        if (string.IsNullOrWhiteSpace(appPassword))
        {
            // Omitir ejecución si no hay credencial activa en variables de entorno
            return;
        }

        // Probamos smtp.zoho.com en puerto 465
        var testConfig = new EmailSmtpConfig
        {
            IsEnabled = true,
            Host = "smtp.zoho.com",
            Port = 465,
            UseSsl = true,
            EncryptionMode = SmtpEncryptionMode.SslTls,
            UserName = targetEmail,
            Password = appPassword,
            SenderEmail = targetEmail,
            SenderName = "EcuNexo Sistema",
        };

        Exception? lastEx = null;
        var sent = false;

        try
        {
            await SmtpEmailSender.SendMimeMessageAsync(
                testConfig,
                targetEmail,
                "EcuNexo Admin",
                "Verificación de Motor SMTP EcuNexo",
                "Mensaje de prueba en texto plano",
                "<h1>EcuNexo</h1><p>Prueba de integración exitosa de correo SMTP.</p>",
                CancellationToken.None,
                logProtocol: true);
            sent = true;
        }
        catch (Exception ex)
        {
            lastEx = ex;
        }

        if (!sent)
        {
            // Reintento en smtppro.zoho.com o puerto 587 si el primero falló por servidor regional
            try
            {
                var altConfig = testConfig with
                {
                    Host = "smtppro.zoho.com",
                    Port = 465,
                    EncryptionMode = SmtpEncryptionMode.SslTls
                };

                await SmtpEmailSender.SendMimeMessageAsync(
                    altConfig,
                    targetEmail,
                    "EcuNexo Admin",
                    "Verificación de Motor SMTP EcuNexo (smtppro)",
                    "Mensaje de prueba en texto plano",
                    "<h1>EcuNexo</h1><p>Prueba de integración exitosa de correo SMTP.</p>",
                    CancellationToken.None,
                    logProtocol: true);
                sent = true;
            }
            catch (Exception ex2)
            {
                lastEx = ex2;
            }
        }

        if (!sent && lastEx is not null)
        {
            throw new InvalidOperationException($"Error al enviar correo SMTP de prueba a {targetEmail}: {lastEx.Message}", lastEx);
        }

        Assert.True(sent, "El correo de prueba debió enviarse correctamente.");
    }
}
