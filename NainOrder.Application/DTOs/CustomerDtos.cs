using System.ComponentModel.DataAnnotations;

namespace NainOrder.Application.DTOs;

public record CreateCustomerRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [Required, EmailAddress, StringLength(150)] string Email);

public record CustomerDto(
    Guid Id,
    string Name,
    string Email,
    DateTime CreatedAt);
