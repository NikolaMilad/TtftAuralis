using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Exceptions;
using TftRecap.Api.Models.Riot;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Services;

public sealed class RiotApiClient : IRiotApiClient
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _httpClient;
    private readonly RiotApiOptions _options;

    public RiotApiClient(HttpClient httpClient, IOptions<RiotApiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<RiotAccountResponse> GetAccountByRiotIdAsync(
        RiotRegionOptions region,
        string riotId,
        string tagline,
        CancellationToken cancellationToken)
    {
        var path = $"https://{region.AccountRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{Uri.EscapeDataString(riotId)}/{Uri.EscapeDataString(tagline)}";
        return await SendAsync<RiotAccountResponse>(path, cancellationToken);
    }

    public async Task<IReadOnlyCollection<string>> GetMatchIdsByPuuidAsync(
        RiotRegionOptions region,
        string puuid,
        long startTime,
        long endTime,
        CancellationToken cancellationToken)
    {
        var result = await GetMatchIdsByPuuidWithMetadataAsync(region, puuid, startTime, endTime, cancellationToken);
        return result.MatchIds;
    }

    public async Task<MatchIdCollectionResult> GetMatchIdsByPuuidWithMetadataAsync(
        RiotRegionOptions region,
        string puuid,
        long startTime,
        long endTime,
        CancellationToken cancellationToken)
    {
        var matchIds = new List<string>();
        var start = 0;
        var pageSize = Math.Clamp(_options.PageSize, 1, 100);
        var rateLimitReached = false;

        while (true)
        {
            var path =
                $"https://{region.MatchRoute}.api.riotgames.com/tft/match/v1/matches/by-puuid/{Uri.EscapeDataString(puuid)}/ids?start={start}&count={pageSize}&startTime={startTime}&endTime={endTime}";

            List<string> page;
            try
            {
                page = await SendAsync<List<string>>(path, cancellationToken);
            }
            catch (ApiException exception) when (exception.StatusCode == HttpStatusCode.TooManyRequests)
            {
                rateLimitReached = true;
                break;
            }

            if (page.Count == 0)
            {
                break;
            }

            matchIds.AddRange(page);

            if (page.Count < pageSize)
            {
                break;
            }

            start += pageSize;
        }

        return new MatchIdCollectionResult
        {
            MatchIds = matchIds,
            RateLimitReached = rateLimitReached
        };
    }

    public async Task<RiotMatchResponse> GetMatchAsync(
        RiotRegionOptions region,
        string matchId,
        CancellationToken cancellationToken)
    {
        var path = $"https://{region.MatchRoute}.api.riotgames.com/tft/match/v1/matches/{Uri.EscapeDataString(matchId)}";
        return await SendAsync<RiotMatchResponse>(path, cancellationToken);
    }

    private async Task<T> SendAsync<T>(string requestUri, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Add("X-Riot-Token", GetApiKey());

        using var response = await _httpClient.SendAsync(request, cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadFromJsonAsync<T>(SerializerOptions, cancellationToken);
            return result ?? throw new ApiException(HttpStatusCode.BadGateway, "Riot returned an empty response body.");
        }

        throw response.StatusCode switch
        {
            HttpStatusCode.NotFound => new ApiException(HttpStatusCode.NotFound, "Riot account or match data was not found."),
            HttpStatusCode.TooManyRequests => new ApiException(HttpStatusCode.TooManyRequests, "Riot API rate limit reached. Please try again shortly."),
            _ => new ApiException(HttpStatusCode.BadGateway, $"Riot API request failed with status {(int)response.StatusCode}.")
        };
    }

    private string GetApiKey()
    {
        var apiKey = Environment.GetEnvironmentVariable(_options.ApiKeyEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new ApiException(HttpStatusCode.InternalServerError, $"Missing Riot API key environment variable '{_options.ApiKeyEnvironmentVariable}'.");
        }

        return apiKey;
    }
}
