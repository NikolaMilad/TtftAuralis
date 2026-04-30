using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Exceptions;
using TftRecap.Api.Services;

namespace TftRecap.Api.Tests.Services;

public sealed class RegionResolverTests
{
    [Fact]
    public void Resolve_ThrowsForUnsupportedRegion()
    {
        var resolver = new RegionResolver(Options.Create(new RiotApiOptions()));

        Assert.Throws<ApiException>(() => resolver.Resolve("unknown"));
    }
}

