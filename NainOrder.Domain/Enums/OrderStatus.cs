namespace NainOrder.Domain.Enums;

public enum OrderStatus
{
    PendingPayment = 1,
    Paid = 2,
    Processing = 3,
    Shipped = 4,
    Cancelled = 5
}
