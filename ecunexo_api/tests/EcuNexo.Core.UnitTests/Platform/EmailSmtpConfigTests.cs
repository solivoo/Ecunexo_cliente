using System.Text.Json;
using EcuNexo.Core.Platform;

namespace EcuNexo.Core.UnitTests.Platform;

public sealed class EmailSmtpConfigTests
{
    [Fact(DisplayName = "EmailSmtpConfig default values match Zoho Mail standards")]
    public void EmailSmtpConfig_DefaultValues_MatchZohoStandards()
    {
        var config = new EmailSmtpConfig();

        config.IsEnabled.Should().BeTrue();
        config.Host.Should().Be("smtp.zoho.com");
        config.Port.Should().Be(465);
        config.UseSsl.Should().BeTrue();
        config.SenderName.Should().Be("EcuNexo");
        config.UserName.Should().BeEmpty();
        config.Password.Should().BeEmpty();
        config.SenderEmail.Should().BeEmpty();
    }

    [Fact(DisplayName = "EmailSmtpConfig can serialize and deserialize JSON round-trip")]
    public void EmailSmtpConfig_JsonRoundTrip_PreservesProperties()
    {
        var original = new EmailSmtpConfig
        {
            IsEnabled = true,
            Host = "smtppro.zoho.com",
            Port = 587,
            UseSsl = true,
            UserName = "admin@empresa.ec",
            Password = "SuperSecretAppPassword123!",
            SenderEmail = "facturacion@empresa.ec",
            SenderName = "Empresa Demo S.A.",
        };

        var json = JsonSerializer.Serialize(original);
        var restored = JsonSerializer.Deserialize<EmailSmtpConfig>(json);

        restored.Should().NotBeNull();
        restored!.IsEnabled.Should().Be(original.IsEnabled);
        restored.Host.Should().Be("smtppro.zoho.com");
        restored.Port.Should().Be(587);
        restored.UseSsl.Should().BeTrue();
        restored.UserName.Should().Be("admin@empresa.ec");
        restored.Password.Should().Be("SuperSecretAppPassword123!");
        restored.SenderEmail.Should().Be("facturacion@empresa.ec");
        restored.SenderName.Should().Be("Empresa Demo S.A.");
    }
}
