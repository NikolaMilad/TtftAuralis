namespace TftRecap.Api.Services.Interfaces;

public interface ITftStaticDataService
{
    Task<StaticAssetInfo> ResolveTraitAsync(string traitId, CancellationToken cancellationToken);

    Task<StaticAssetInfo> ResolveUnitAsync(string unitId, CancellationToken cancellationToken);

    Task<StaticAssetInfo> ResolveItemAsync(string itemId, CancellationToken cancellationToken);
}

public sealed record StaticAssetInfo(string Id, string Name, string? IconUrl);
