using TftRecap.Api.Models.Requests;
using TftRecap.Api.Models.Responses;

namespace TftRecap.Api.Services.Interfaces;

public interface IRecapService
{
    Task<YearlyRecapResponse> BuildYearlyRecapAsync(YearlyRecapRequest request, CancellationToken cancellationToken);
}

