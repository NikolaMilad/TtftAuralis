using TftRecap.Api.Configuration;
using TftRecap.Api.Models.Responses;

namespace TftRecap.Api.Services.Interfaces;

public interface IRegionResolver
{
    RiotRegionOptions Resolve(string regionKey);

    IReadOnlyCollection<RegionOptionDto> GetAvailableRegions();
}

