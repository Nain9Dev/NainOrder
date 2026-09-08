using NainOrder.Application.DTOs;
using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Services;

public class CustomerService : ICustomerService
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CustomerService(ICustomerRepository customerRepository, IUnitOfWork unitOfWork)
    {
        _customerRepository = customerRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CustomerDto> CreateCustomerAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _customerRepository.EmailExistsAsync(email, cancellationToken))
            throw new ConflictException("duplicate_email", $"A customer with email '{email}' already exists.");

        var customer = new Customer(request.Name, request.Email);

        await _customerRepository.AddAsync(customer, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(customer);
    }

    public async Task<IReadOnlyList<CustomerDto>> GetAllCustomersAsync(CancellationToken cancellationToken = default)
    {
        var customers = await _customerRepository.GetAllAsync(cancellationToken);
        return customers.Select(MapToDto).ToList();
    }

    private static CustomerDto MapToDto(Customer c) => new(c.Id, c.Name, c.Email, c.CreatedAt);
}
