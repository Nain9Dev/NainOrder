using FsCheck.Xunit;
using NainOrder.Domain.Exceptions;
using NainOrder.Domain.ValueObjects;
using Xunit;

namespace NainOrder.Tests.Domain;

public class ValueObjectTests
{
    [Fact]
    public void Money_Zero_InitializesWithZeroAmountAndDefaultCurrency()
    {
        var zero = Money.Zero();
        Assert.Equal(0m, zero.Amount);
        Assert.Equal("EUR", zero.Currency);
    }

    [Fact]
    public void Money_NegativeAmount_ThrowsInvalidDomainDataException()
    {
        Assert.Throws<InvalidDomainDataException>(() => new Money(-10m));
    }

    [Fact]
    public void Money_DifferentCurrenciesAddition_ThrowsInvalidDomainDataException()
    {
        var eur = new Money(50m, "EUR");
        var usd = new Money(50m, "USD");
        Assert.Throws<InvalidDomainDataException>(() => eur + usd);
    }

    [Property]
    public void Money_Addition_IsCommutative(int seedA, int seedB)
    {
        var amountA = Math.Abs(seedA % 100_000) / 100m;
        var amountB = Math.Abs(seedB % 100_000) / 100m;

        var a = new Money(amountA);
        var b = new Money(amountB);

        var result1 = a + b;
        var result2 = b + a;

        Assert.Equal(result1, result2);
        Assert.Equal(result1.Amount, result2.Amount);
    }

    [Property]
    public void Money_Multiplication_MatchesRepeatedAddition(int seed, int multiplierSeed)
    {
        var amount = Math.Abs(seed % 10_000) / 100m;
        var count = Math.Abs(multiplierSeed % 10) + 1;

        var money = new Money(amount);
        var multiplied = money * count;

        var accumulated = Money.Zero();
        for (var i = 0; i < count; i++)
        {
            accumulated += money;
        }

        Assert.Equal(accumulated, multiplied);
    }

    [Theory]
    [InlineData("valid.user@example.com")]
    [InlineData("test.account+nain@company.org")]
    [InlineData("customer_123@sub.domain.co")]
    public void EmailAddress_ValidFormats_Succeeds(string email)
    {
        var address = new EmailAddress(email);
        Assert.Equal(email.ToLowerInvariant(), address.Value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("invalid-email")]
    [InlineData("@missing-user.com")]
    [InlineData("missing-domain@")]
    [InlineData("spaces in@email.com")]
    public void EmailAddress_InvalidFormats_ThrowsInvalidDomainDataException(string invalidEmail)
    {
        Assert.Throws<InvalidDomainDataException>(() => new EmailAddress(invalidEmail));
    }
}
