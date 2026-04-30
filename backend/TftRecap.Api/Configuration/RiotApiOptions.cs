namespace TftRecap.Api.Configuration;

public sealed class RiotApiOptions
{
    public const string SectionName = "RiotApi";

    public string ApiKeyEnvironmentVariable { get; set; } = "RIOT_API_KEY";

    public int RequestTimeoutSeconds { get; set; } = 30;

    public int MatchFetchConcurrency { get; set; } = 5;

    public int PageSize { get; set; } = 20;

    public List<RiotRegionOptions> Regions { get; set; } = [];
}

public sealed class RiotRegionOptions
{
    public string Key { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string AccountRoute { get; set; } = string.Empty;

    public string MatchRoute { get; set; } = string.Empty;
}

