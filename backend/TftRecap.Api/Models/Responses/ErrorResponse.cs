namespace TftRecap.Api.Models.Responses;

public sealed class ErrorResponse
{
    public required string Message { get; init; }

    public IReadOnlyCollection<string> Details { get; init; } = [];
}

