namespace NainOrder.Domain.Entities;

public class Customer
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public string Email { get; private set; }

    // Constructor privado para EF Core
    private Customer() { }

    public Customer(string name, string email)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Customer name cannot be empty", nameof(name));
            
        if (string.IsNullOrWhiteSpace(email) || !email.Contains("@"))
            throw new ArgumentException("Invalid email address", nameof(email));

        Id = Guid.NewGuid();
        Name = name;
        Email = email;
    }

    public void UpdateEmail(string newEmail)
    {
        if (string.IsNullOrWhiteSpace(newEmail) || !newEmail.Contains("@"))
            throw new ArgumentException("Invalid email address", nameof(newEmail));
            
        Email = newEmail;
    }
}
