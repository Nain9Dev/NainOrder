using NainOrder.Domain.Exceptions;

namespace NainOrder.Domain.Entities;

/// <summary>Cliente que emite pedidos. El email actúa como clave natural del agregado.</summary>
public class Customer
{
    public const int MaxNameLength = 100;
    public const int MaxEmailLength = 150;

    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }

    private Customer() { }

    public Customer(string name, string email)
    {
        Name = NormalizeName(name);
        Email = NormalizeEmail(email);
        Id = Guid.NewGuid();
        CreatedAt = DateTime.UtcNow;
    }

    public void UpdateEmail(string newEmail) => Email = NormalizeEmail(newEmail);

    public void Rename(string newName) => Name = NormalizeName(newName);

    private static string NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidDomainDataException(nameof(name), "Customer name cannot be empty.");

        var trimmed = name.Trim();
        if (trimmed.Length > MaxNameLength)
            throw new InvalidDomainDataException(nameof(name), $"Customer name cannot exceed {MaxNameLength} characters.");

        return trimmed;
    }

    private static string NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidDomainDataException(nameof(email), "Email is required.");

        var trimmed = email.Trim().ToLowerInvariant();

        // Validación deliberadamente simple y acotada: un único '@' con contenido a ambos
        // lados y un punto en el dominio. Se evita cualquier regex con backtracking.
        var at = trimmed.IndexOf('@');
        var valid = at > 0
                    && at == trimmed.LastIndexOf('@')
                    && at < trimmed.Length - 1
                    && trimmed.LastIndexOf('.') > at + 1
                    && trimmed.Length <= MaxEmailLength
                    && !trimmed.Contains(' ')
                    && !trimmed.EndsWith('.');

        if (!valid)
            throw new InvalidDomainDataException(nameof(email), $"'{email}' is not a valid email address.");

        return trimmed;
    }
}
