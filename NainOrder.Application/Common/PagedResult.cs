namespace NainOrder.Application.Common;

/// <summary>Página de resultados con los metadatos que el cliente necesita para paginar sin adivinar.</summary>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious => Page > 1;
    public bool HasNext => Page < TotalPages;

    public static PagedResult<T> Empty(int page, int pageSize) => new([], page, pageSize, 0);
}

/// <summary>Parámetros de paginación normalizados: nunca dejan pasar valores fuera de rango.</summary>
public sealed record PageRequest
{
    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 20;

    public int Page { get; }
    public int PageSize { get; }

    public PageRequest(int? page, int? pageSize)
    {
        Page = page is null or < 1 ? 1 : page.Value;
        PageSize = pageSize switch
        {
            null or < 1 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => pageSize.Value
        };
    }

    public int Skip => (Page - 1) * PageSize;
}
