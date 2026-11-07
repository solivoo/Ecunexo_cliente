using EcuNexo.Business.Identity.ApiKeys;

namespace EcuNexo.Business.UnitTests.Identity;

public sealed class TenantApiKeyCryptoTests
{
    [Fact]
    public void GenerateKey_GeneratesUniqueKeysWithProperLengthAndFormat()
    {
        var (key1, prefix1, hash1) = TenantApiKeyCrypto.GenerateKey();
        var (key2, prefix2, hash2) = TenantApiKeyCrypto.GenerateKey();

        Assert.NotEqual(key1, key2);
        Assert.NotEqual(prefix1, prefix2);
        Assert.NotEqual(hash1, hash2);

        // Format: ecx_live_<prefix8>_<secret48> -> 9 + 8 + 1 + 48 = 66 chars
        Assert.Equal(66, key1.Length);
        Assert.StartsWith("ecx_live_", key1, StringComparison.Ordinal);
        Assert.Equal(17, prefix1.Length); // "ecx_live_" (9) + 8 hex = 17
        Assert.Equal(64, hash1.Length); // SHA-256 hex string = 64
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("invalid_prefix_12345678_abcdef")]
    [InlineData("ecx_live_short")]
    [InlineData("ecx_live_1234567")] // 7 hex instead of 8
    [InlineData("ecx_live_12345678")] // no trailing secret
    [InlineData("ecx_live_12345678-secret")] // hyphen instead of underscore
    public void TryExtractPrefix_WhenInvalidFormat_ReturnsFalse(string? candidate)
    {
        var result = TenantApiKeyCrypto.TryExtractPrefix(candidate, out var prefix, out var trimmed);

        Assert.False(result);
        Assert.Empty(prefix);
        Assert.Empty(trimmed);
    }

    [Fact]
    public void TryExtractPrefix_WhenValidWithWhitespace_TrimsAndExtractsPrefix()
    {
        const string rawKey = "  ecx_live_a1b2c3d4_0123456789abcdef0123456789abcdef0123456789abcdef  ";

        var result = TenantApiKeyCrypto.TryExtractPrefix(rawKey, out var prefix, out var trimmed);

        Assert.True(result);
        Assert.Equal("ecx_live_a1b2c3d4", prefix);
        Assert.Equal("ecx_live_a1b2c3d4_0123456789abcdef0123456789abcdef0123456789abcdef", trimmed);
    }

    [Fact]
    public void ComputeSha256Hex_IsDeterministicAndLowerCase()
    {
        const string input = "ecx_live_deadbeef_testsecretvalue1234567890";
        var hash1 = TenantApiKeyCrypto.ComputeSha256Hex(input);
        var hash2 = TenantApiKeyCrypto.ComputeSha256Hex(input);

        Assert.Equal(hash1, hash2);
        Assert.Equal(64, hash1.Length);
        Assert.True(hash1.All(c => char.IsAsciiHexDigitLower(c)));
    }

    [Theory]
    [InlineData(null, "somehash")]
    [InlineData("somekey", null)]
    [InlineData("", "somehash")]
    [InlineData("somekey", "")]
    [InlineData("somekey", "short_hash")] // Not 64 chars
    public void VerifyFixedTime_WhenInvalidInputs_ReturnsFalse(string? key, string? hash)
    {
        var result = TenantApiKeyCrypto.VerifyFixedTime(key!, hash!);
        Assert.False(result);
    }

    [Fact]
    public void VerifyFixedTime_WhenHashMatches_ReturnsTrueRegardlessOfHashCasing()
    {
        var (plainKey, _, hash) = TenantApiKeyCrypto.GenerateKey();

        Assert.True(TenantApiKeyCrypto.VerifyFixedTime(plainKey, hash));
        Assert.True(TenantApiKeyCrypto.VerifyFixedTime(plainKey, hash.ToUpperInvariant()));
    }

    [Fact]
    public void VerifyFixedTime_WhenKeyTampered_ReturnsFalse()
    {
        var (plainKey, _, hash) = TenantApiKeyCrypto.GenerateKey();
        var tampered = plainKey[..^1] + (plainKey[^1] == 'a' ? 'b' : 'a');

        Assert.False(TenantApiKeyCrypto.VerifyFixedTime(tampered, hash));
    }
}
