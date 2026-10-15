using NainOrder.Application.DTOs;

namespace NainOrder.Tests.Application;

public class StockLevelsTests
{
    [Theory]
    [InlineData(-10, "out_of_stock")]
    [InlineData(0, "out_of_stock")]
    [InlineData(1, "low_stock")]
    [InlineData(5, "low_stock")]
    [InlineData(6, "in_stock")]
    [InlineData(100, "in_stock")]
    public void Classify_maps_stock_quantities_to_expected_classification(int quantity, string expectedStatus)
    {
        var status = StockLevels.Classify(quantity);
        Assert.Equal(expectedStatus, status);
    }
}
