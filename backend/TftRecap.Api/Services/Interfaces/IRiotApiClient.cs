using TftRecap.Api.Configuration;
using TftRecap.Api.Models.Riot;

namespace TftRecap.Api.Services.Interfaces;

public interface IRiotApiClient
{
    Task<RiotAccountResponse> GetAccountByRiotIdAsync(
        RiotRegionOptions region,
        string riotId,
        string tagline,
        CancellationToken cancellationToken);

    Task<IReadOnlyCollection<string>> GetMatchIdsByPuuidAsync(
        RiotRegionOptions region,
        string puuid,
        long startTime,
        long endTime,
        CancellationToken cancellationToken);

    Task<MatchIdCollectionResult> GetMatchIdsByPuuidWithMetadataAsync(
        RiotRegionOptions region,
        string puuid,
        long startTime,
        long endTime,
        CancellationToken cancellationToken);

    Task<RiotMatchResponse> GetMatchAsync(
        RiotRegionOptions region,
        string matchId,
        CancellationToken cancellationToken);
}

public sealed class MatchIdCollectionResult
{
    public required IReadOnlyCollection<string> MatchIds { get; init; }

    public bool RateLimitReached { get; init; }
}
