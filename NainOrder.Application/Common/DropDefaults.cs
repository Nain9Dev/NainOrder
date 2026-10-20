namespace NainOrder.Application.Common;

public static class DropDefaults
{
    /// <summary>
    /// The one customer every drop order belongs to: buyers are anonymous visitors identified
    /// only by a token (Q-005). Fixed so the seeder and the use case agree on it.
    /// </summary>
    public static readonly Guid AnonymousBuyerId = Guid.Parse("5d0c6f0e-7b0a-4f3e-9a3e-0d0e5a1b2c3d");
}
