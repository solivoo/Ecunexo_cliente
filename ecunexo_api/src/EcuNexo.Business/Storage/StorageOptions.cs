namespace EcuNexo.Business.Storage;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string Provider { get; set; } = "BackblazeB2";
    public string ServiceUrl { get; set; } = "https://s3.us-east-005.backblazeb2.com";
    public string Region { get; set; } = "us-east-005";
    public string PublicBucket { get; set; } = "ecunexo-publico-assets";
    public string PrivateBucket { get; set; } = "ecunexo-private-assets";
    public string KeyId { get; set; } = string.Empty;
    public string ApplicationKey { get; set; } = string.Empty;
}
