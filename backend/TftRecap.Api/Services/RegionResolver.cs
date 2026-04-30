using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Exceptions;
using TftRecap.Api.Models.Responses;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Services;

public sealed class RegionResolver : IRegionResolver
{
    private readonly Dictionary<string, RiotRegionOptions> _regions;

    public RegionResolver(IOptions<RiotApiOptions> options)
    {
        _regions = options.Value.Regions.ToDictionary(
            region => region.Key,
            region => region,
            StringComparer.OrdinalIgnoreCase);
    }

    public RiotRegionOptions Resolve(string regionKey)
    {
        if (_regions.TryGetValue(regionKey, out var region))
        {
            return region;
        }

        throw new ApiException(System.Net.HttpStatusCode.BadRequest, "The selected region is not supported.");
    }

    public IReadOnlyCollection<RegionOptionDto> GetAvailableRegions()
    {
        return _regions.Values
            .OrderBy(region => region.DisplayName)
            .Select(region => new RegionOptionDto
            {
                Key = region.Key,
                DisplayName = region.DisplayName
            })
            .ToArray();
    }
}

