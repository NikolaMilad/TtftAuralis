using Microsoft.AspNetCore.Mvc;
using TftRecap.Api.Models.Responses;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class RegionsController : ControllerBase
{
    private readonly IRegionResolver _regionResolver;

    public RegionsController(IRegionResolver regionResolver)
    {
        _regionResolver = regionResolver;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<RegionOptionDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyCollection<RegionOptionDto>> Get()
    {
        return Ok(_regionResolver.GetAvailableRegions());
    }
}

