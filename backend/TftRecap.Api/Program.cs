using System.Net;
using Microsoft.Extensions.Options;
using TftRecap.Api.Configuration;
using TftRecap.Api.Exceptions;
using TftRecap.Api.Models.Responses;
using TftRecap.Api.Services;
using TftRecap.Api.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<RiotApiOptions>(builder.Configuration.GetSection(RiotApiOptions.SectionName));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>() ?? [];

    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<IRegionResolver, RegionResolver>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpClient<ITftStaticDataService, TftStaticDataService>();
builder.Services.AddScoped<IRecapService, RecapService>();
builder.Services.AddHttpClient<IRiotApiClient, RiotApiClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<IOptions<RiotApiOptions>>().Value;
    client.Timeout = TimeSpan.FromSeconds(Math.Max(5, options.RequestTimeoutSeconds));
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (ApiException exception)
    {
        context.Response.StatusCode = (int)exception.StatusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorResponse
        {
            Message = exception.Message
        });
    }
    catch (Exception)
    {
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorResponse
        {
            Message = "An unexpected server error occurred."
        });
    }
});

app.UseCors();
app.MapControllers();

app.Run();

public partial class Program;
