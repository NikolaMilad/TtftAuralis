using System.ComponentModel.DataAnnotations;

namespace TftRecap.Api.Models.Requests;

public sealed class YearlyRecapRequest
{
    [Required]
    [MaxLength(32)]
    public string RiotId { get; set; } = string.Empty;

    [Required]
    [MaxLength(8)]
    public string Tagline { get; set; } = string.Empty;

    [Required]
    public string Region { get; set; } = string.Empty;

    [Range(1, 7)]
    public int Days { get; set; } = 1;
}
