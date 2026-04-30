using System.Text.Json.Serialization;

namespace TftRecap.Api.Models.Riot;

public sealed class RiotMatchResponse
{
    [JsonPropertyName("metadata")]
    public RiotMatchMetadata Metadata { get; set; } = new();

    [JsonPropertyName("info")]
    public RiotMatchInfo Info { get; set; } = new();
}

public sealed class RiotMatchMetadata
{
    [JsonPropertyName("match_id")]
    public string MatchId { get; set; } = string.Empty;
}

public sealed class RiotMatchInfo
{
    [JsonPropertyName("game_datetime")]
    public long GameDateTime { get; set; }

    [JsonPropertyName("participants")]
    public List<RiotParticipant> Participants { get; set; } = [];
}

public sealed class RiotParticipant
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("placement")]
    public int Placement { get; set; }

    [JsonPropertyName("total_damage_to_players")]
    public double TotalDamageToPlayers { get; set; }

    [JsonPropertyName("traits")]
    public List<RiotTrait> Traits { get; set; } = [];

    [JsonPropertyName("units")]
    public List<RiotUnit> Units { get; set; } = [];
}

public sealed class RiotTrait
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("num_units")]
    public int NumUnits { get; set; }

    [JsonPropertyName("style")]
    public int Style { get; set; }

    [JsonPropertyName("tier_current")]
    public int TierCurrent { get; set; }
}

public sealed class RiotUnit
{
    [JsonPropertyName("character_id")]
    public string CharacterId { get; set; } = string.Empty;

    [JsonPropertyName("itemNames")]
    public List<string>? ItemNames { get; set; }

    [JsonPropertyName("items")]
    public List<int>? Items { get; set; }
}
