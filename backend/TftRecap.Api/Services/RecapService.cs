using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Exceptions;
using TftRecap.Api.Models.Requests;
using TftRecap.Api.Models.Responses;
using TftRecap.Api.Models.Riot;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Services;

public sealed class RecapService : IRecapService
{
    private readonly IRiotApiClient _riotApiClient;
    private readonly IRegionResolver _regionResolver;
    private readonly ITftStaticDataService _tftStaticDataService;
    private readonly RiotApiOptions _options;
    private readonly TimeProvider _timeProvider;

    public RecapService(
        IRiotApiClient riotApiClient,
        IRegionResolver regionResolver,
        ITftStaticDataService tftStaticDataService,
        IOptions<RiotApiOptions> options,
        TimeProvider timeProvider)
    {
        _riotApiClient = riotApiClient;
        _regionResolver = regionResolver;
        _tftStaticDataService = tftStaticDataService;
        _options = options.Value;
        _timeProvider = timeProvider;
    }

    public async Task<YearlyRecapResponse> BuildYearlyRecapAsync(YearlyRecapRequest request, CancellationToken cancellationToken)
    {
        Validate(request);

        var region = _regionResolver.Resolve(request.Region);
        var account = await _riotApiClient.GetAccountByRiotIdAsync(region, request.RiotId.Trim(), request.Tagline.Trim(), cancellationToken);

        var (startUtc, endUtc) = GetRequestedRange(_timeProvider, request.Days);
        var startTime = new DateTimeOffset(startUtc).ToUnixTimeSeconds();
        var endTime = new DateTimeOffset(endUtc).ToUnixTimeSeconds();

        var matchIdResult = await _riotApiClient.GetMatchIdsByPuuidWithMetadataAsync(region, account.Puuid, startTime, endTime, cancellationToken);
        var warnings = new List<string>();
        var matchesResult = await GetMatchesAsync(region, account.Puuid, matchIdResult.MatchIds, warnings, cancellationToken);

        var rateLimitReached = matchIdResult.RateLimitReached || matchesResult.RateLimitReached;
        if (rateLimitReached && matchesResult.Matches.Count > 0)
        {
            var availableStart = matchesResult.Matches.Min(match => match.PlayedAtUtc);
            var availableEnd = matchesResult.Matches.Max(match => match.PlayedAtUtc);
            warnings.Add($"Only games from {availableStart:u} to {availableEnd:u} were retrieved because of Riot API rate limits.");
        }
        else if (rateLimitReached)
        {
            warnings.Add("Riot API rate limits prevented match retrieval for the full requested range.");
        }

        return await BuildResponseAsync(
            request,
            account,
            matchIdResult.MatchIds.Count,
            matchesResult.Matches,
            warnings,
            startUtc,
            endUtc,
            rateLimitReached,
            cancellationToken);
    }

    public static (DateTime StartUtc, DateTime EndUtc) GetRequestedRange(TimeProvider timeProvider, int days)
    {
        var clampedDays = Math.Clamp(days, 1, 7);
        var localNow = timeProvider.GetLocalNow();
        var localTimeZone = timeProvider.LocalTimeZone;
        var todayLocal = new DateTime(localNow.Year, localNow.Month, localNow.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var startLocal = todayLocal.AddDays(-(clampedDays - 1));
        var endLocal = todayLocal.AddDays(1).AddSeconds(-1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, localTimeZone);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, localTimeZone);

        return (startUtc, endUtc);
    }

    private static void Validate(YearlyRecapRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RiotId))
        {
            throw new ApiException(System.Net.HttpStatusCode.BadRequest, "Riot ID is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Tagline))
        {
            throw new ApiException(System.Net.HttpStatusCode.BadRequest, "Tagline is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Region))
        {
            throw new ApiException(System.Net.HttpStatusCode.BadRequest, "Region is required.");
        }

        if (request.Days is < 1 or > 7)
        {
            throw new ApiException(System.Net.HttpStatusCode.BadRequest, "Days must be between 1 and 7.");
        }
    }

    private async Task<PlayedMatchCollectionResult> GetMatchesAsync(
        RiotRegionOptions region,
        string puuid,
        IReadOnlyCollection<string> matchIds,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        if (matchIds.Count == 0)
        {
            warnings.Add("No TFT matches were found in the selected recap window.");
            return new PlayedMatchCollectionResult
            {
                Matches = [],
                RateLimitReached = false
            };
        }

        var matches = new List<PlayedMatch>();
        var rateLimitReached = false;

        foreach (var matchId in matchIds)
        {
            try
            {
                var match = await _riotApiClient.GetMatchAsync(region, matchId, cancellationToken);
                var participant = match.Info.Participants.FirstOrDefault(player =>
                    string.Equals(player.Puuid, puuid, StringComparison.Ordinal));

                if (participant is null)
                {
                    warnings.Add($"Match {matchId} did not contain the requested player.");
                    continue;
                }

                var playedAtUtc = match.Info.GameDateTime > 0
                    ? DateTimeOffset.FromUnixTimeMilliseconds(match.Info.GameDateTime).UtcDateTime
                    : DateTime.MinValue;

                matches.Add(new PlayedMatch(match.Metadata.MatchId, playedAtUtc, participant));
            }
            catch (ApiException exception) when (exception.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                rateLimitReached = true;
                break;
            }
            catch (ApiException exception)
            {
                warnings.Add($"Skipping match {matchId}: {exception.Message}");
            }
        }

        return new PlayedMatchCollectionResult
        {
            Matches = matches.ToArray(),
            RateLimitReached = rateLimitReached
        };
    }

    private async Task<YearlyRecapResponse> BuildResponseAsync(
        YearlyRecapRequest request,
        RiotAccountResponse account,
        int requestedMatchCount,
        IReadOnlyCollection<PlayedMatch> matches,
        IReadOnlyCollection<string> warnings,
        DateTime startUtc,
        DateTime endUtc,
        bool rateLimitReached,
        CancellationToken cancellationToken)
    {
        var traitCounts = new Dictionary<string, FavoriteAccumulator>(StringComparer.OrdinalIgnoreCase);
        var unitCounts = new Dictionary<string, FavoriteAccumulator>(StringComparer.OrdinalIgnoreCase);
        var itemCounts = new Dictionary<string, FavoriteAccumulator>(StringComparer.OrdinalIgnoreCase);
        var playedMatchDtos = new List<PlayedMatchDto>();

        foreach (var match in matches.OrderByDescending(match => match.PlayedAtUtc))
        {
            var traitDtos = new List<MatchTraitDto>();
            var unitDtos = new List<MatchUnitDto>();
            var matchItemCounts = new Dictionary<string, MatchItemAccumulator>(StringComparer.OrdinalIgnoreCase);

            foreach (var trait in match.Participant.Traits.Where(IsDisplayedTrait))
            {
                var traitAsset = await _tftStaticDataService.ResolveTraitAsync(trait.Name, cancellationToken);
                IncrementFavorite(traitCounts, traitAsset);

                traitDtos.Add(new MatchTraitDto
                {
                    Id = traitAsset.Id,
                    Name = traitAsset.Name,
                    IconUrl = traitAsset.IconUrl,
                    NumUnits = trait.NumUnits,
                    TierCurrent = trait.TierCurrent,
                    Style = trait.Style
                });
            }

            foreach (var unit in match.Participant.Units)
            {
                StaticAssetInfo? unitAsset = null;
                if (!string.IsNullOrWhiteSpace(unit.CharacterId))
                {
                    unitAsset = await _tftStaticDataService.ResolveUnitAsync(unit.CharacterId, cancellationToken);
                    IncrementFavorite(unitCounts, unitAsset);
                }

                var unitItems = new List<MatchItemDto>();
                foreach (var itemId in GetItemNames(unit))
                {
                    var itemAsset = await _tftStaticDataService.ResolveItemAsync(itemId, cancellationToken);
                    IncrementFavorite(itemCounts, itemAsset);
                    IncrementMatchItem(matchItemCounts, itemAsset);

                    unitItems.Add(new MatchItemDto
                    {
                        Id = itemAsset.Id,
                        Name = itemAsset.Name,
                        IconUrl = itemAsset.IconUrl,
                        Count = 1
                    });
                }

                if (unitAsset is not null)
                {
                    unitDtos.Add(new MatchUnitDto
                    {
                        Id = unitAsset.Id,
                        Name = unitAsset.Name,
                        IconUrl = unitAsset.IconUrl,
                        Items = unitItems
                    });
                }
            }

            playedMatchDtos.Add(new PlayedMatchDto
            {
                MatchId = match.MatchId,
                PlayedAtUtc = match.PlayedAtUtc,
                Placement = match.Participant.Placement,
                TotalDamageToPlayers = match.Participant.TotalDamageToPlayers,
                Traits = traitDtos
                    .OrderByDescending(trait => trait.Style)
                    .ThenByDescending(trait => trait.NumUnits)
                    .ThenBy(trait => trait.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                Units = unitDtos
                    .OrderBy(unit => unit.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                Items = matchItemCounts.Values
                    .OrderByDescending(item => item.Count)
                    .ThenBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(item => new MatchItemDto
                    {
                        Id = item.Id,
                        Name = item.Name,
                        IconUrl = item.IconUrl,
                        Count = item.Count
                    })
                    .ToArray()
            });
        }

        return new YearlyRecapResponse
        {
            Player = new PlayerIdentityDto
            {
                RiotId = account.GameName,
                Tagline = account.TagLine,
                Puuid = account.Puuid,
                Region = request.Region
            },
            Range = new RecapRangeDto
            {
                StartUtc = startUtc,
                EndUtc = endUtc,
                Days = request.Days
            },
            Summary = new RecapSummaryDto
            {
                TotalGames = matches.Count,
                Wins = matches.Count(match => match.Participant.Placement == 1),
                Top4s = matches.Count(match => match.Participant.Placement <= 4),
                TotalPlayerDamage = matches.Sum(match => match.Participant.TotalDamageToPlayers),
                AveragePlacement = matches.Count == 0 ? 0 : Math.Round(matches.Average(match => match.Participant.Placement), 2)
            },
            Favorites = new FavoriteCollectionDto
            {
                Traits = ToFavorites(traitCounts),
                Units = ToFavorites(unitCounts),
                Items = ToFavorites(itemCounts)
            },
            Matches = playedMatchDtos,
            Groups = BuildGroups(playedMatchDtos),
            Meta = new RecapMetadataDto
            {
                ProcessedMatchCount = matches.Count,
                RequestedMatchCount = requestedMatchCount,
                RateLimitReached = rateLimitReached,
                AvailableRangeStartUtc = matches.Count > 0 ? matches.Min(match => match.PlayedAtUtc) : null,
                AvailableRangeEndUtc = matches.Count > 0 ? matches.Max(match => match.PlayedAtUtc) : null,
                Warnings = warnings.ToArray()
            }
        };
    }

    private static RecapGroupsDto BuildGroups(IReadOnlyCollection<PlayedMatchDto> matches)
    {
        var championGroups = new Dictionary<string, PlacementAccumulator>(StringComparer.OrdinalIgnoreCase);
        var synergyGroups = new Dictionary<string, PlacementAccumulator>(StringComparer.OrdinalIgnoreCase);
        var itemGroups = new Dictionary<string, PlacementAccumulator>(StringComparer.OrdinalIgnoreCase);
        var compGroups = new Dictionary<string, TopCompAccumulator>(StringComparer.OrdinalIgnoreCase);

        foreach (var match in matches)
        {
            foreach (var unit in match.Units)
            {
                IncrementPlacementAccumulator(championGroups, unit.Id, unit.Name, unit.IconUrl, match.Placement);
            }

            foreach (var trait in match.Traits)
            {
                IncrementPlacementAccumulator(synergyGroups, trait.Id, trait.Name, trait.IconUrl, match.Placement);
            }

            foreach (var item in match.Items)
            {
                IncrementPlacementAccumulator(itemGroups, item.Id, item.Name, item.IconUrl, match.Placement);
            }

            var compTraits = match.Traits
                .OrderByDescending(trait => trait.Style)
                .ThenByDescending(trait => trait.NumUnits)
                .ThenBy(trait => trait.Name, StringComparer.OrdinalIgnoreCase)
                .Take(3)
                .Select(trait => trait.Name)
                .ToArray();

            var compUnits = match.Units
                .Take(4)
                .Select(unit => unit.Name)
                .ToArray();

            var compKey = string.Join(" + ", compTraits);
            if (string.IsNullOrWhiteSpace(compKey))
            {
                compKey = string.Join(", ", compUnits.Take(2));
            }

            if (!string.IsNullOrWhiteSpace(compKey))
            {
                if (compGroups.TryGetValue(compKey, out var currentComp))
                {
                    compGroups[compKey] = currentComp with
                    {
                        Games = currentComp.Games + 1,
                        PlacementTotal = currentComp.PlacementTotal + match.Placement
                    };
                }
                else
                {
                    compGroups[compKey] = new TopCompAccumulator(compKey, compKey, compUnits, compTraits, 1, match.Placement);
                }
            }
        }

        return new RecapGroupsDto
        {
            PerformanceOverview = new PerformanceOverviewGroupDto
            {
                TotalGames = matches.Count,
                Wins = matches.Count(match => match.Placement == 1),
                Top4s = matches.Count(match => match.Placement <= 4),
                AveragePlacement = matches.Count == 0 ? 0 : Math.Round(matches.Average(match => match.Placement), 2),
                TotalDamage = Math.Round(matches.Sum(match => match.TotalDamageToPlayers), 1),
                BestPlacement = matches.Count == 0 ? 0 : matches.Min(match => match.Placement),
                WorstPlacement = matches.Count == 0 ? 0 : matches.Max(match => match.Placement)
            },
            Champions = championGroups.Values
                .OrderByDescending(entry => entry.Games)
                .ThenBy(entry => entry.AveragePlacement)
                .Take(8)
                .Select(entry => new ChampionGroupEntryDto
                {
                    Id = entry.Id,
                    Name = entry.Name,
                    IconUrl = entry.IconUrl,
                    Games = entry.Games,
                    AveragePlacement = entry.AveragePlacement,
                    Top4s = entry.Top4s
                })
                .ToArray(),
            Synergies = synergyGroups.Values
                .OrderBy(entry => entry.AveragePlacement)
                .ThenByDescending(entry => entry.Games)
                .Take(8)
                .Select(entry => new SynergyGroupEntryDto
                {
                    Id = entry.Id,
                    Name = entry.Name,
                    IconUrl = entry.IconUrl,
                    Appearances = entry.Games,
                    AveragePlacement = entry.AveragePlacement,
                    Wins = entry.Wins
                })
                .ToArray(),
            PlacementDistribution = Enumerable.Range(1, 8)
                .Select(placement => new PlacementDistributionEntryDto
                {
                    Placement = placement,
                    Games = matches.Count(match => match.Placement == placement)
                })
                .ToArray(),
            Items = itemGroups.Values
                .OrderByDescending(entry => entry.Games)
                .ThenBy(entry => entry.AveragePlacement)
                .Take(8)
                .Select(entry => new ItemGroupEntryDto
                {
                    Id = entry.Id,
                    Name = entry.Name,
                    IconUrl = entry.IconUrl,
                    Builds = entry.Games,
                    AveragePlacement = entry.AveragePlacement
                })
                .ToArray(),
            TopComps = compGroups.Values
                .OrderBy(entry => entry.AveragePlacement)
                .ThenByDescending(entry => entry.Games)
                .Take(6)
                .Select(entry => new TopCompGroupEntryDto
                {
                    Key = entry.Key,
                    Title = entry.Title,
                    Units = entry.Units,
                    Traits = entry.Traits,
                    Games = entry.Games,
                    AveragePlacement = Math.Round(entry.PlacementTotal / (double)entry.Games, 2)
                })
                .ToArray()
        };
    }

    private static IEnumerable<string> GetItemNames(RiotUnit unit)
    {
        if (unit.ItemNames is { Count: > 0 })
        {
            return unit.ItemNames.Where(item => !string.IsNullOrWhiteSpace(item));
        }

        if (unit.Items is { Count: > 0 })
        {
            return unit.Items.Select(item => item.ToString());
        }

        return [];
    }

    private static IReadOnlyCollection<FavoriteStatDto> ToFavorites(Dictionary<string, FavoriteAccumulator> counts)
    {
        return counts.Values
            .OrderByDescending(entry => entry.Count)
            .ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .Select(entry => new FavoriteStatDto
            {
                Id = entry.Id,
                Name = entry.Name,
                IconUrl = entry.IconUrl,
                Count = entry.Count
            })
            .ToArray();
    }

    private static void IncrementFavorite(IDictionary<string, FavoriteAccumulator> counts, StaticAssetInfo asset)
    {
        if (counts.TryGetValue(asset.Id, out var current))
        {
            counts[asset.Id] = current with { Count = current.Count + 1 };
            return;
        }

        counts[asset.Id] = new FavoriteAccumulator(asset.Id, asset.Name, asset.IconUrl, 1);
    }

    private static void IncrementMatchItem(IDictionary<string, MatchItemAccumulator> counts, StaticAssetInfo asset)
    {
        if (counts.TryGetValue(asset.Id, out var current))
        {
            counts[asset.Id] = current with { Count = current.Count + 1 };
            return;
        }

        counts[asset.Id] = new MatchItemAccumulator(asset.Id, asset.Name, asset.IconUrl, 1);
    }

    private static bool IsDisplayedTrait(RiotTrait trait)
    {
        return !string.IsNullOrWhiteSpace(trait.Name) && trait.NumUnits > 0 && (trait.Style > 0 || trait.TierCurrent > 0);
    }

    private static void IncrementPlacementAccumulator(
        IDictionary<string, PlacementAccumulator> counts,
        string id,
        string name,
        string? iconUrl,
        int placement)
    {
        if (counts.TryGetValue(id, out var current))
        {
            counts[id] = current with
            {
                Games = current.Games + 1,
                PlacementTotal = current.PlacementTotal + placement,
                Top4s = current.Top4s + (placement <= 4 ? 1 : 0),
                Wins = current.Wins + (placement == 1 ? 1 : 0)
            };
            return;
        }

        counts[id] = new PlacementAccumulator(
            id,
            name,
            iconUrl,
            1,
            placement,
            placement <= 4 ? 1 : 0,
            placement == 1 ? 1 : 0);
    }

    private sealed record PlayedMatch(string MatchId, DateTime PlayedAtUtc, RiotParticipant Participant);

    private sealed record FavoriteAccumulator(string Id, string Name, string? IconUrl, int Count);

    private sealed record MatchItemAccumulator(string Id, string Name, string? IconUrl, int Count);

    private sealed record PlacementAccumulator(
        string Id,
        string Name,
        string? IconUrl,
        int Games,
        int PlacementTotal,
        int Top4s,
        int Wins)
    {
        public double AveragePlacement => Math.Round(PlacementTotal / (double)Games, 2);
    }

    private sealed record TopCompAccumulator(
        string Key,
        string Title,
        IReadOnlyCollection<string> Units,
        IReadOnlyCollection<string> Traits,
        int Games,
        int PlacementTotal)
    {
        public double AveragePlacement => Math.Round(PlacementTotal / (double)Games, 2);
    }

    private sealed class PlayedMatchCollectionResult
    {
        public required IReadOnlyCollection<PlayedMatch> Matches { get; init; }

        public bool RateLimitReached { get; init; }
    }
}
