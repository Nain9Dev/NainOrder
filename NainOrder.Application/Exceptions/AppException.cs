namespace NainOrder.Application.Exceptions;

/// <summary>
/// Fallo de caso de uso: la petición es sintácticamente válida pero no puede completarse
/// (recurso inexistente, conflicto de concurrencia...). Distinto de una violación de
/// invariante del dominio y distinto de un fallo técnico inesperado.
/// </summary>
public abstract class AppException : Exception
{
    /// <summary>Código estable y legible por máquina, consumible por el cliente.</summary>
    public abstract string Code { get; }

    protected AppException(string message) : base(message) { }
}

/// <summary>El recurso solicitado no existe.</summary>
public sealed class NotFoundException : AppException
{
    public override string Code => "not_found";

    public string Resource { get; }
    public object Key { get; }

    public NotFoundException(string resource, object key)
        : base($"{resource} '{key}' was not found.")
    {
        Resource = resource;
        Key = key;
    }
}

/// <summary>La operación choca con el estado actual del sistema (duplicado, concurrencia...).</summary>
public sealed class ConflictException : AppException
{
    public override string Code { get; }

    public ConflictException(string code, string message) : base(message) => Code = code;
}
