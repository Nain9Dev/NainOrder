using NetArchTest.Rules;
using Xunit;

namespace NainOrder.Tests.Architecture;

public sealed class CleanArchitectureTests
{
    private static readonly System.Reflection.Assembly DomainAssembly = typeof(NainOrder.Domain.Entities.Order).Assembly;
    private static readonly System.Reflection.Assembly ApplicationAssembly = typeof(NainOrder.Application.DependencyInjection).Assembly;
    private static readonly System.Reflection.Assembly InfrastructureAssembly = typeof(NainOrder.Infrastructure.DependencyInjection).Assembly;
    private static readonly System.Reflection.Assembly ApiAssembly = typeof(NainOrder.Api.Controllers.OrdersController).Assembly;

    [Fact]
    public void Domain_Should_Not_Have_Dependency_On_Other_Projects()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "NainOrder.Application",
                "NainOrder.Infrastructure",
                "NainOrder.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, $"Domain layer has illegal dependencies on outer layers: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void Application_Should_Not_Have_Dependency_On_Infrastructure_Or_Api()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "NainOrder.Infrastructure",
                "NainOrder.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, $"Application layer has illegal dependencies: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void Infrastructure_Should_Not_Have_Dependency_On_Api()
    {
        var result = Types.InAssembly(InfrastructureAssembly)
            .ShouldNot()
            .HaveDependencyOn("NainOrder.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, $"Infrastructure layer has illegal dependencies on Api: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void Domain_Entities_Should_Not_Depend_On_External_Libraries()
    {
        var result = Types.InAssembly(DomainAssembly)
            .That()
            .ResideInNamespace("NainOrder.Domain.Entities")
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore")
            .GetResult();

        Assert.True(result.IsSuccessful, $"Domain entities must not depend on EF Core or ASP.NET Core: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void Domain_Entities_Should_Implement_IEntity()
    {
        var entityTypes = DomainAssembly.GetTypes()
            .Where(t => t.IsPublic && !t.IsNested && t.IsClass && !t.IsAbstract && t.Namespace == "NainOrder.Domain.Entities")
            .ToList();

        var nonCompliant = entityTypes
            .Where(t => !typeof(NainOrder.Domain.Primitives.IEntity).IsAssignableFrom(t))
            .Select(t => t.FullName)
            .ToList();

        Assert.True(nonCompliant.Count == 0, $"Domain entities must implement IEntity: {string.Join(", ", nonCompliant)}");
    }

    [Fact]
    public void Application_Services_Should_Be_Sealed()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .ResideInNamespace("NainOrder.Application.Services")
            .And()
            .AreClasses()
            .Should()
            .BeSealed()
            .GetResult();

        Assert.True(result.IsSuccessful, $"Application services must be sealed: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }
}

