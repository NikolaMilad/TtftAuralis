using System.Text.Json.Serialization;

namespace TftRecap.Api.Models.Riot;

public sealed class RiotAccountResponse
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("gameName")]
    public string GameName { get; set; } = string.Empty;

    [JsonPropertyName("tagLine")]
    public string TagLine { get; set; } = string.Empty;
}

