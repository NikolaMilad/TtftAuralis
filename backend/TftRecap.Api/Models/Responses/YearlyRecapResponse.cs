namespace TftRecap.Api.Models.Responses;

public sealed class YearlyRecapResponse
{
    public required PlayerIdentityDto Player { get; init; }

    public required RecapRangeDto Range { get; init; }

    public required RecapSummaryDto Summary { get; init; }

    public required FavoriteCollectionDto Favorites { get; init; }

    public IReadOnlyCollection<PlayedMatchDto> Matches { get; init; } = [];

    public required RecapGroupsDto Groups { get; init; }

    public required RecapMetadataDto Meta { get; init; }
}

public sealed class PlayerIdentityDto
{
    public required string RiotId { get; init; }

    public required string Tagline { get; init; }

    public required string Puuid { get; init; }

    public required string Region { get; init; }
}

public sealed class RecapRangeDto
{
    public required DateTime StartUtc { get; init; }

    public required DateTime EndUtc { get; init; }

    public int Days { get; init; }
}

public sealed class RecapSummaryDto
{
    public int TotalGames { get; init; }

    public int Wins { get; init; }

    public int Top4s { get; init; }

    public double TotalPlayerDamage { get; init; }

    public double AveragePlacement { get; init; }
}

public sealed class FavoriteCollectionDto
{
    public IReadOnlyCollection<FavoriteStatDto> Traits { get; init; } = [];

    public IReadOnlyCollection<FavoriteStatDto> Units { get; init; } = [];

    public IReadOnlyCollection<FavoriteStatDto> Items { get; init; } = [];
}

public sealed class FavoriteStatDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int Count { get; init; }
}

public sealed class PlayedMatchDto
{
    public required string MatchId { get; init; }

    public required DateTime PlayedAtUtc { get; init; }

    public int Placement { get; init; }

    public double TotalDamageToPlayers { get; init; }

    public IReadOnlyCollection<MatchTraitDto> Traits { get; init; } = [];

    public IReadOnlyCollection<MatchUnitDto> Units { get; init; } = [];

    public IReadOnlyCollection<MatchItemDto> Items { get; init; } = [];
}

public sealed class MatchTraitDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int NumUnits { get; init; }

    public int TierCurrent { get; init; }

    public int Style { get; init; }
}

public sealed class MatchUnitDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public IReadOnlyCollection<MatchItemDto> Items { get; init; } = [];
}

public sealed class MatchItemDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int Count { get; init; }
}

public sealed class RecapMetadataDto
{
    public int ProcessedMatchCount { get; init; }

    public int RequestedMatchCount { get; init; }

    public bool RateLimitReached { get; init; }

    public DateTime? AvailableRangeStartUtc { get; init; }

    public DateTime? AvailableRangeEndUtc { get; init; }

    public IReadOnlyCollection<string> Warnings { get; init; } = [];
}

public sealed class RecapGroupsDto
{
    public required PerformanceOverviewGroupDto PerformanceOverview { get; init; }

    public IReadOnlyCollection<ChampionGroupEntryDto> Champions { get; init; } = [];

    public IReadOnlyCollection<SynergyGroupEntryDto> Synergies { get; init; } = [];

    public IReadOnlyCollection<PlacementDistributionEntryDto> PlacementDistribution { get; init; } = [];

    public IReadOnlyCollection<ItemGroupEntryDto> Items { get; init; } = [];

    public IReadOnlyCollection<TopCompGroupEntryDto> TopComps { get; init; } = [];
}

public sealed class PerformanceOverviewGroupDto
{
    public int TotalGames { get; init; }

    public int Wins { get; init; }

    public int Top4s { get; init; }

    public double AveragePlacement { get; init; }

    public double TotalDamage { get; init; }

    public int BestPlacement { get; init; }

    public int WorstPlacement { get; init; }
}

public sealed class ChampionGroupEntryDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int Games { get; init; }

    public double AveragePlacement { get; init; }

    public int Top4s { get; init; }
}

public sealed class SynergyGroupEntryDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int Appearances { get; init; }

    public double AveragePlacement { get; init; }

    public int Wins { get; init; }
}

public sealed class PlacementDistributionEntryDto
{
    public int Placement { get; init; }

    public int Games { get; init; }
}

public sealed class ItemGroupEntryDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? IconUrl { get; init; }

    public int Builds { get; init; }

    public double AveragePlacement { get; init; }
}

public sealed class TopCompGroupEntryDto
{
    public required string Key { get; init; }

    public required string Title { get; init; }

    public IReadOnlyCollection<string> Units { get; init; } = [];

    public IReadOnlyCollection<string> Traits { get; init; } = [];

    public int Games { get; init; }

    public double AveragePlacement { get; init; }
}
