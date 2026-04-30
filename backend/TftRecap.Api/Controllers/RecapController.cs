using Microsoft.AspNetCore.Mvc;
using TftRecap.Api.Models.Requests;
using TftRecap.Api.Models.Responses;
using TftRecap.Api.Services.Interfaces;

namespace TftRecap.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class RecapController : ControllerBase
{
    private readonly IRecapService _recapService;

    public RecapController(IRecapService recapService)
    {
        _recapService = recapService;
    }

    [HttpPost("yearly")]
    [ProducesResponseType(typeof(YearlyRecapResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<YearlyRecapResponse>> GetYearlyRecap(
        [FromBody] YearlyRecapRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _recapService.BuildYearlyRecapAsync(request, cancellationToken);
        return Ok(response);
    }
}

