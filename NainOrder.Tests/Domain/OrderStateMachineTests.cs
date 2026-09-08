using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Tests.Domain;

/// <summary>
/// La máquina de estados es la regla de negocio con más riesgo del agregado: se prueba
/// tanto lo que debe permitir como, sobre todo, lo que debe impedir.
/// </summary>
public class OrderStateMachineTests
{
    private static Order OrderWithOneItem()
    {
        var order = new Order(Guid.NewGuid());
        order.AddItem(Guid.NewGuid(), "Laptop Pro", "NO-LAP-001", 1500m, 1);
        return order;
    }

    [Fact]
    public void A_new_order_starts_pending_payment_and_is_editable()
    {
        var order = new Order(Guid.NewGuid());

        Assert.Equal(OrderStatus.PendingPayment, order.Status);
        Assert.True(order.IsEditable);
        Assert.Equal(0m, order.TotalAmount);
        Assert.StartsWith("NO-", order.Reference);
    }

    [Fact]
    public void The_happy_path_walks_pending_paid_processing_shipped()
    {
        var order = OrderWithOneItem();

        order.MarkAsPaid();
        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.NotNull(order.PaidAt);

        order.MarkAsProcessing();
        Assert.Equal(OrderStatus.Processing, order.Status);

        order.MarkAsShipped();
        Assert.Equal(OrderStatus.Shipped, order.Status);
        Assert.NotNull(order.ShippedAt);
        Assert.Empty(order.NextStates);
    }

    [Fact]
    public void An_empty_order_cannot_be_paid()
    {
        var order = new Order(Guid.NewGuid());

        var error = Assert.Throws<InvalidOrderStateException>(order.MarkAsPaid);
        Assert.Equal("invalid_order_state", error.Code);
    }

    [Fact]
    public void Shipping_without_processing_first_is_rejected()
    {
        var order = OrderWithOneItem();
        order.MarkAsPaid();

        Assert.Throws<InvalidOrderStateException>(order.MarkAsShipped);
    }

    [Fact]
    public void A_shipped_order_cannot_be_cancelled()
    {
        var order = OrderWithOneItem();
        order.MarkAsPaid();
        order.MarkAsProcessing();
        order.MarkAsShipped();

        Assert.Throws<InvalidOrderStateException>(() => order.Cancel());
    }

    [Fact]
    public void Cancelling_reports_every_unit_that_must_go_back_to_the_catalogue()
    {
        var firstProduct = Guid.NewGuid();
        var secondProduct = Guid.NewGuid();

        var order = new Order(Guid.NewGuid());
        order.AddItem(firstProduct, "Monitor", "NO-MON-001", 400m, 3);
        order.AddItem(secondProduct, "Teclado", "NO-KEY-001", 120m, 2);

        var restorations = order.Cancel();

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.NotNull(order.CancelledAt);
        Assert.Equal(3, restorations.Single(r => r.ProductId == firstProduct).Quantity);
        Assert.Equal(2, restorations.Single(r => r.ProductId == secondProduct).Quantity);
    }

    [Fact]
    public void The_basket_is_frozen_once_the_order_is_paid()
    {
        var order = OrderWithOneItem();
        var productId = order.Items.Single().ProductId;
        order.MarkAsPaid();

        Assert.False(order.IsEditable);
        Assert.Throws<InvalidOrderStateException>(() => order.AddItem(Guid.NewGuid(), "X", "SKU-X", 1m, 1));
        Assert.Throws<InvalidOrderStateException>(() => order.RemoveItem(productId));
        Assert.Throws<InvalidOrderStateException>(() => order.ChangeItemQuantity(productId, 5));
    }

    [Fact]
    public void The_same_product_cannot_be_added_twice()
    {
        var productId = Guid.NewGuid();
        var order = new Order(Guid.NewGuid());
        order.AddItem(productId, "Monitor", "NO-MON-001", 400m, 1);

        var error = Assert.Throws<DuplicateOrderItemException>(
            () => order.AddItem(productId, "Monitor", "NO-MON-001", 400m, 1));

        Assert.Equal(productId, error.ProductId);
    }

    [Fact]
    public void Changing_the_quantity_reports_the_exact_stock_delta()
    {
        var productId = Guid.NewGuid();
        var order = new Order(Guid.NewGuid());
        order.AddItem(productId, "Monitor", "NO-MON-001", 400m, 2);

        Assert.Equal(3, order.ChangeItemQuantity(productId, 5));
        Assert.Equal(-4, order.ChangeItemQuantity(productId, 1));
        Assert.Equal(1, order.TotalUnits);
    }

    [Fact]
    public void Removing_a_line_that_is_not_in_the_order_is_rejected()
    {
        var order = new Order(Guid.NewGuid());

        Assert.Throws<OrderItemNotFoundException>(() => order.RemoveItem(Guid.NewGuid()));
    }

    [Fact]
    public void An_order_always_needs_a_customer()
    {
        Assert.Throws<InvalidDomainDataException>(() => new Order(Guid.Empty));
    }

    [Theory]
    [InlineData(OrderStatus.PendingPayment, new[] { OrderStatus.Paid, OrderStatus.Cancelled })]
    [InlineData(OrderStatus.Paid, new[] { OrderStatus.Processing, OrderStatus.Cancelled })]
    [InlineData(OrderStatus.Processing, new[] { OrderStatus.Shipped, OrderStatus.Cancelled })]
    [InlineData(OrderStatus.Shipped, new OrderStatus[0])]
    [InlineData(OrderStatus.Cancelled, new OrderStatus[0])]
    public void The_published_transition_table_matches_the_expected_contract(
        OrderStatus from, OrderStatus[] expected)
    {
        Assert.Equal(expected, Order.TransitionsFrom(from));
    }
}
