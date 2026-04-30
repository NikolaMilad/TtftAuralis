using System.Net.Http.Json;
using System.Text.RegularExpressions;
using TftRecap.Api.Models.Riot;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Services;

public sealed partial class TftStaticDataService : ITftStaticDataService
{
    private static readonly Uri VersionsUri = new("https://ddragon.leagueoflegends.com/api/versions.json");
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(12);
    private static readonly Regex PrefixRegex = BuildPrefixRegex();
    private static readonly Regex PathRegex = BuildPathRegex();
    private static readonly Regex CamelBoundaryRegex = BuildCamelBoundaryRegex();

    private readonly HttpClient _httpClient;
    private readonly SemaphoreSlim _cacheGate = new(1, 1);
    private StaticLookupCache? _cache;

    public TftStaticDataService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<StaticAssetInfo> ResolveTraitAsync(string traitId, CancellationToken cancellationToken)
    {
        var cache = await GetCacheAsync(cancellationToken);
        return ResolveAsset(cache.Traits, traitId);
    }

    public async Task<StaticAssetInfo> ResolveUnitAsync(string unitId, CancellationToken cancellationToken)
    {
        var cache = await GetCacheAsync(cancellationToken);
        return ResolveAsset(cache.Units, unitId);
    }

    public async Task<StaticAssetInfo> ResolveItemAsync(string itemId, CancellationToken cancellationToken)
    {
        var cache = await GetCacheAsync(cancellationToken);
        return ResolveAsset(cache.Items, itemId);
    }

    private async Task<StaticLookupCache> GetCacheAsync(CancellationToken cancellationToken)
    {
        if (_cache is not null && _cache.ExpiresAtUtc > DateTimeOffset.UtcNow)
        {
            return _cache;
        }

        await _cacheGate.WaitAsync(cancellationToken);
        try
        {
            if (_cache is not null && _cache.ExpiresAtUtc > DateTimeOffset.UtcNow)
            {
                return _cache;
            }

            var versions = await _httpClient.GetFromJsonAsync<string[]>(VersionsUri, cancellationToken)
                ?? throw new InvalidOperationException("Unable to fetch Riot Data Dragon versions.");

            var latestVersion = versions.FirstOrDefault()
                ?? throw new InvalidOperationException("Riot Data Dragon returned no versions.");

            var traitResponse = await _httpClient.GetFromJsonAsync<TftStaticDataResponse<TftTraitStaticEntry>>(
                $"https://ddragon.leagueoflegends.com/cdn/{latestVersion}/data/en_US/tft-trait.json",
                cancellationToken);
            var championResponse = await _httpClient.GetFromJsonAsync<TftStaticDataResponse<TftChampionStaticEntry>>(
                $"https://ddragon.leagueoflegends.com/cdn/{latestVersion}/data/en_US/tft-champion.json",
                cancellationToken);
            var itemResponse = await _httpClient.GetFromJsonAsync<TftStaticDataResponse<TftItemStaticEntry>>(
                $"https://ddragon.leagueoflegends.com/cdn/{latestVersion}/data/en_US/tft-item.json",
                cancellationToken);

            _cache = new StaticLookupCache(
                BuildLookup(
                    traitResponse?.Data?.Values ?? Enumerable.Empty<TftTraitStaticEntry>(),
                    entry => entry.Id,
                    entry => new StaticAssetInfo(entry.Id, entry.Name, ToCommunityDragonUrl(entry.Icon))),
                BuildLookup(
                    championResponse?.Data?.Values ?? Enumerable.Empty<TftChampionStaticEntry>(),
                    entry => entry.Id,
                    entry => new StaticAssetInfo(
                        entry.Id,
                        entry.Name,
                        string.IsNullOrWhiteSpace(entry.Image?.Full)
                            ? null
                            : $"https://ddragon.leagueoflegends.com/cdn/{latestVersion}/img/tft-champion/{entry.Image.Full}")),
                BuildLookup(
                    itemResponse?.Data?.Values ?? Enumerable.Empty<TftItemStaticEntry>(),
                    entry => entry.Id,
                    entry => new StaticAssetInfo(
                        entry.Id,
                        entry.Name,
                        string.IsNullOrWhiteSpace(entry.Image?.Full)
                            ? null
                            : $"https://ddragon.leagueoflegends.com/cdn/{latestVersion}/img/tft-item/{entry.Image.Full}")),
                DateTimeOffset.UtcNow.Add(CacheDuration));

            return _cache;
        }
        finally
        {
            _cacheGate.Release();
        }
    }

    private static Dictionary<string, StaticAssetInfo> BuildLookup<TEntry>(
        IEnumerable<TEntry> entries,
        Func<TEntry, string> idSelector,
        Func<TEntry, StaticAssetInfo> assetSelector)
    {
        var lookup = new Dictionary<string, StaticAssetInfo>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            var id = idSelector(entry);
            var asset = assetSelector(entry);

            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(asset.Name))
            {
                continue;
            }

            lookup[id] = asset;
        }

        return lookup;
    }

    private static StaticAssetInfo ResolveAsset(IReadOnlyDictionary<string, StaticAssetInfo> lookup, string rawId)
    {
        if (string.IsNullOrWhiteSpace(rawId))
        {
            return new StaticAssetInfo("unknown", "Unknown", null);
        }

        var normalizedId = NormalizeId(rawId);
        if (lookup.TryGetValue(rawId, out var directMatch))
        {
            return directMatch;
        }

        if (lookup.TryGetValue(normalizedId, out var normalizedMatch))
        {
            return normalizedMatch;
        }

        return new StaticAssetInfo(normalizedId, HumanizeIdentifier(normalizedId), null);
    }

    private static string NormalizeId(string rawId)
    {
        var pathMatch = PathRegex.Match(rawId);
        return pathMatch.Success ? pathMatch.Value : rawId;
    }

    private static string HumanizeIdentifier(string rawId)
    {
        var withoutPrefix = PrefixRegex.Replace(rawId, string.Empty);
        var withSpaces = withoutPrefix.Replace('_', ' ');
        withSpaces = CamelBoundaryRegex.Replace(withSpaces, "$1 $2");
        withSpaces = Regex.Replace(withSpaces, @"\s+", " ").Trim();

        return string.IsNullOrWhiteSpace(withSpaces) ? rawId : withSpaces;
    }

    private static string? ToCommunityDragonUrl(string rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            return null;
        }

        var normalizedPath = rawPath
            .Replace("\\", "/")
            .TrimStart('/')
            .ToLowerInvariant();

        if (normalizedPath.StartsWith("assets/"))
        {
            return $"https://raw.communitydragon.org/latest/game/{normalizedPath}";
        }

        return $"https://raw.communitydragon.org/latest/{normalizedPath}";
    }

    private sealed record StaticLookupCache(
        IReadOnlyDictionary<string, StaticAssetInfo> Traits,
        IReadOnlyDictionary<string, StaticAssetInfo> Units,
        IReadOnlyDictionary<string, StaticAssetInfo> Items,
        DateTimeOffset ExpiresAtUtc);

    [GeneratedRegex(@"^(Maps/Shipping/Map\d+/Sets/TFTSet\d+/Shop/)?TFT\d+_")]
    private static partial Regex BuildPrefixRegex();

    [GeneratedRegex(@"TFT\d+_[A-Za-z0-9]+$")]
    private static partial Regex BuildPathRegex();

    [GeneratedRegex(@"([a-z])([A-Z])")]
    private static partial Regex BuildCamelBoundaryRegex();
}
