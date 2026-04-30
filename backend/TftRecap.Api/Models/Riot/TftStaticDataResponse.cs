using System.Text.Json.Serialization;

namespace TftRecap.Api.Models.Riot;

public sealed class TftStaticDataResponse<TEntry>
{
    [JsonPropertyName("data")]
    public Dictionary<string, TEntry> Data { get; set; } = [];
}

public sealed class TftTraitStaticEntry
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("icon")]
    public string Icon { get; set; } = string.Empty;
}

public sealed class TftChampionStaticEntry
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("image")]
    public TftStaticImageEntry? Image { get; set; }
}

public sealed class TftItemStaticEntry
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("image")]
    public TftStaticImageEntry? Image { get; set; }
}

public sealed class TftStaticImageEntry
{
    [JsonPropertyName("full")]
    public string Full { get; set; } = string.Empty;
}
