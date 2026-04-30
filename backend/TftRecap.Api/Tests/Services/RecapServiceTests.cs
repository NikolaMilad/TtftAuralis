using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Models.Requests;
using TftRecap.Api.Models.Riot;
using TftRecap.Api.Services;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Tests.Services;

public sealed class RecapServiceTests
{
    [Fact]
    public async Task BuildYearlyRecapAsync_AggregatesRequestedFields()
    {
        var client = new FakeRiotApiClient();
        var timeProvider = new FixedTimeProvider(new DateTimeOffset(2026, 4, 26, 15, 45, 0, TimeSpan.FromHours(-4)));
        var options = Options.Create(new RiotApiOptions
        {
            MatchFetchConcurrency = 2,
            Regions =
            [
                new RiotRegionOptions
                {
                    Key = "na1",
                    DisplayName = "North America",
                    AccountRoute = "americas",
                    MatchRoute = "americas"
                }
            ]
        });

        var service = new RecapService(
            client,
            new RegionResolver(options),
            new FakeTftStaticDataService(),
            options,
            timeProvider);

        var response = await service.BuildYearlyRecapAsync(new YearlyRecapRequest
        {
            RiotId = "PlayerOne",
            Tagline = "NA1",
            Region = "na1",
            Days = 1
        }, CancellationToken.None);

        Assert.Equal(3, response.Summary.TotalGames);
        Assert.Equal(1, response.Summary.Wins);
        Assert.Equal(2, response.Summary.Top4s);
        Assert.Equal(55, response.Summary.TotalPlayerDamage);
        Assert.Equal(4d, response.Summary.AveragePlacement);
        Assert.Equal("Bruiser", response.Favorites.Traits.First().Name);
        Assert.Equal("Sylas", response.Favorites.Units.First().Name);
        Assert.Equal("Rabadon's Deathcap", response.Favorites.Items.First().Name);
        Assert.NotNull(response.Favorites.Items.First().IconUrl);
        Assert.Equal(3, response.Matches.Count);
        Assert.Equal("match-3", response.Matches.First().MatchId);
        Assert.NotEmpty(response.Matches.First().Items);
        Assert.NotEmpty(response.Matches.First().Units);
        Assert.Equal(1, response.Range.Days);
        Assert.Equal(new DateTime(2026, 4, 26, 4, 0, 0, DateTimeKind.Utc), response.Range.StartUtc);
        Assert.Equal(new DateTime(2026, 4, 27, 3, 59, 59, DateTimeKind.Utc), response.Range.EndUtc);
    }

    [Fact]
    public void GetRequestedRange_UsesServerLocalDayWindow()
    {
        var timeProvider = new FixedTimeProvider(new DateTimeOffset(2026, 4, 26, 15, 45, 0, TimeSpan.FromHours(-4)));
        var (startUtc, endUtc) = RecapService.GetRequestedRange(timeProvider, 1);

        Assert.Equal(new DateTime(2026, 4, 26, 4, 0, 0, DateTimeKind.Utc), startUtc);
        Assert.Equal(new DateTime(2026, 4, 27, 3, 59, 59, DateTimeKind.Utc), endUtc);
    }

    [Fact]
    public async Task BuildYearlyRecapAsync_AddsWarningsForSkippedMatches()
    {
        var options = Options.Create(new RiotApiOptions
        {
            MatchFetchConcurrency = 2,
            Regions =
            [
                new RiotRegionOptions
                {
                    Key = "na1",
                    DisplayName = "North America",
                    AccountRoute = "americas",
                    MatchRoute = "americas"
                }
            ]
        });

        var service = new RecapService(
            new PartialFailureRiotApiClient(),
            new RegionResolver(options),
            new FakeTftStaticDataService(),
            options,
            new FixedTimeProvider(new DateTimeOffset(2026, 4, 26, 15, 45, 0, TimeSpan.FromHours(-4))));
        var response = await service.BuildYearlyRecapAsync(new YearlyRecapRequest
        {
            RiotId = "PlayerOne",
            Tagline = "NA1",
            Region = "na1",
            Days = 1
        }, CancellationToken.None);

        Assert.Single(response.Meta.Warnings);
        Assert.Equal(1, response.Meta.ProcessedMatchCount);
        Assert.Equal(2, response.Meta.RequestedMatchCount);
    }

    [Fact]
    public async Task BuildYearlyRecapAsync_UsesCurrentDayEpochBounds()
    {
        var client = new FakeRiotApiClient();
        var timeProvider = new FixedTimeProvider(new DateTimeOffset(2026, 4, 26, 15, 45, 0, TimeSpan.FromHours(-4)));
        var options = Options.Create(new RiotApiOptions
        {
            MatchFetchConcurrency = 2,
            Regions =
            [
                new RiotRegionOptions
                {
                    Key = "na1",
                    DisplayName = "North America",
                    AccountRoute = "americas",
                    MatchRoute = "americas"
                }
            ]
        });

        var service = new RecapService(
            client,
            new RegionResolver(options),
            new FakeTftStaticDataService(),
            options,
            timeProvider);

        await service.BuildYearlyRecapAsync(new YearlyRecapRequest
        {
            RiotId = "PlayerOne",
            Tagline = "NA1",
            Region = "na1",
            Days = 1
        }, CancellationToken.None);

        Assert.Equal(new DateTimeOffset(2026, 4, 26, 4, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds(), client.LastStartTime);
        Assert.Equal(new DateTimeOffset(2026, 4, 27, 3, 59, 59, TimeSpan.Zero).ToUnixTimeSeconds(), client.LastEndTime);
    }

    private sealed class FakeRiotApiClient : IRiotApiClient
    {
        public long? LastStartTime { get; private set; }

        public long? LastEndTime { get; private set; }

        public Task<RiotAccountResponse> GetAccountByRiotIdAsync(RiotRegionOptions region, string riotId, string tagline, CancellationToken cancellationToken)
        {
            return Task.FromResult(new RiotAccountResponse
            {
                GameName = riotId,
                TagLine = tagline,
                Puuid = "puuid-123"
            });
        }

        public Task<IReadOnlyCollection<string>> GetMatchIdsByPuuidAsync(RiotRegionOptions region, string puuid, long startTime, long endTime, CancellationToken cancellationToken)
        {
            LastStartTime = startTime;
            LastEndTime = endTime;
            return Task.FromResult<IReadOnlyCollection<string>>(["match-1", "match-2", "match-3"]);
        }

        public Task<MatchIdCollectionResult> GetMatchIdsByPuuidWithMetadataAsync(RiotRegionOptions region, string puuid, long startTime, long endTime, CancellationToken cancellationToken)
        {
            LastStartTime = startTime;
            LastEndTime = endTime;
            return Task.FromResult(new MatchIdCollectionResult
            {
                MatchIds = ["match-1", "match-2", "match-3"],
                RateLimitReached = false
            });
        }

        public Task<RiotMatchResponse> GetMatchAsync(RiotRegionOptions region, string matchId, CancellationToken cancellationToken)
        {
            return Task.FromResult(matchId switch
            {
                "match-1" => CreateMatch(matchId, 1, 20, "Set14_Trait_Bruiser", "TFT14_Sylas", "TFT_Item_RabadonsDeathcap"),
                "match-2" => CreateMatch(matchId, 4, 15, "Set14_Trait_Bruiser", "TFT14_Sylas", "TFT_Item_RabadonsDeathcap"),
                _ => CreateMatch(matchId, 7, 20, "Set14_Trait_Marksman", "TFT14_Varus", "TFT_Item_GuinsoosRageblade")
            });
        }

        private static RiotMatchResponse CreateMatch(string matchId, int placement, double damage, string trait, string unit, string item)
        {
            return new RiotMatchResponse
            {
                Metadata = new RiotMatchMetadata { MatchId = matchId },
                Info = new RiotMatchInfo
                {
                    GameDateTime = matchId switch
                    {
                        "match-1" => new DateTimeOffset(2026, 4, 26, 12, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds(),
                        "match-2" => new DateTimeOffset(2026, 4, 26, 15, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds(),
                        _ => new DateTimeOffset(2026, 4, 26, 18, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds()
                    },
                    Participants =
                    [
                        new RiotParticipant
                        {
                            Puuid = "puuid-123",
                            Placement = placement,
                            TotalDamageToPlayers = damage,
                            Traits = [new RiotTrait { Name = trait, NumUnits = 2, Style = 1, TierCurrent = 1 }],
                            Units =
                            [
                                new RiotUnit
                                {
                                    CharacterId = unit,
                                    ItemNames = [item]
                                }
                            ]
                        }
                    ]
                }
            };
        }
    }

    private sealed class PartialFailureRiotApiClient : IRiotApiClient
    {
        public Task<RiotAccountResponse> GetAccountByRiotIdAsync(RiotRegionOptions region, string riotId, string tagline, CancellationToken cancellationToken)
        {
            return Task.FromResult(new RiotAccountResponse
            {
                GameName = riotId,
                TagLine = tagline,
                Puuid = "puuid-123"
            });
        }

        public Task<IReadOnlyCollection<string>> GetMatchIdsByPuuidAsync(RiotRegionOptions region, string puuid, long startTime, long endTime, CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyCollection<string>>(["match-1", "match-2"]);
        }

        public Task<MatchIdCollectionResult> GetMatchIdsByPuuidWithMetadataAsync(RiotRegionOptions region, string puuid, long startTime, long endTime, CancellationToken cancellationToken)
        {
            return Task.FromResult(new MatchIdCollectionResult
            {
                MatchIds = ["match-1", "match-2"],
                RateLimitReached = false
            });
        }

        public Task<RiotMatchResponse> GetMatchAsync(RiotRegionOptions region, string matchId, CancellationToken cancellationToken)
        {
            if (matchId == "match-2")
            {
                throw new TftRecap.Api.Exceptions.ApiException(System.Net.HttpStatusCode.BadGateway, "Mock failure.");
            }

            return Task.FromResult(new RiotMatchResponse
            {
                Metadata = new RiotMatchMetadata { MatchId = matchId },
                Info = new RiotMatchInfo
                {
                    GameDateTime = new DateTimeOffset(2026, 4, 26, 12, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds(),
                    Participants =
                    [
                        new RiotParticipant
                        {
                            Puuid = "puuid-123",
                            Placement = 1,
                            TotalDamageToPlayers = 20,
                            Traits = [new RiotTrait { Name = "TFT17_ManaTrait", NumUnits = 2, Style = 1, TierCurrent = 1 }]
                        }
                    ]
                }
            });
        }
    }

    private sealed class FakeTftStaticDataService : ITftStaticDataService
    {
        public Task<StaticAssetInfo> ResolveTraitAsync(string traitId, CancellationToken cancellationToken)
        {
            return Task.FromResult(traitId switch
            {
                "Set14_Trait_Bruiser" => new StaticAssetInfo("Set14_Trait_Bruiser", "Bruiser", "https://example.com/traits/bruiser.png"),
                "Set14_Trait_Marksman" => new StaticAssetInfo("Set14_Trait_Marksman", "Marksman", "https://example.com/traits/marksman.png"),
                "TFT17_ManaTrait" => new StaticAssetInfo("TFT17_ManaTrait", "Conduit", "https://example.com/traits/conduit.png"),
                _ => new StaticAssetInfo(traitId, traitId, null)
            });
        }

        public Task<StaticAssetInfo> ResolveUnitAsync(string unitId, CancellationToken cancellationToken)
        {
            return Task.FromResult(unitId switch
            {
                "TFT14_Sylas" => new StaticAssetInfo("TFT14_Sylas", "Sylas", "https://example.com/units/sylas.png"),
                "TFT14_Varus" => new StaticAssetInfo("TFT14_Varus", "Varus", "https://example.com/units/varus.png"),
                _ => new StaticAssetInfo(unitId, unitId, null)
            });
        }

        public Task<StaticAssetInfo> ResolveItemAsync(string itemId, CancellationToken cancellationToken)
        {
            return Task.FromResult(itemId switch
            {
                "TFT_Item_RabadonsDeathcap" => new StaticAssetInfo("TFT_Item_RabadonsDeathcap", "Rabadon's Deathcap", "https://example.com/items/rabadons.png"),
                "TFT_Item_GuinsoosRageblade" => new StaticAssetInfo("TFT_Item_GuinsoosRageblade", "Guinsoo's Rageblade", "https://example.com/items/guinsoos.png"),
                _ => new StaticAssetInfo(itemId, itemId, null)
            });
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _localNow;
        private readonly TimeZoneInfo _localTimeZone;

        public FixedTimeProvider(DateTimeOffset localNow)
        {
            _localNow = localNow;
            _localTimeZone = TimeZoneInfo.CreateCustomTimeZone(
                "FixedLocal",
                localNow.Offset,
                "FixedLocal",
                "FixedLocal");
        }

        public override DateTimeOffset GetUtcNow() => _localNow.ToUniversalTime();

        public override TimeZoneInfo LocalTimeZone => _localTimeZone;
    }
}
