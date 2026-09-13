namespace IncomeMeter.Api.Services;

public interface IFileStorageService
{
    /// <summary>Persist the stream under the given key and return the key.</summary>
    Task<string> SaveAsync(string storageKey, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>Open a read stream for the key, or null if it does not exist.</summary>
    Task<Stream?> OpenReadAsync(string storageKey, CancellationToken ct = default);

    Task DeleteAsync(string storageKey, CancellationToken ct = default);
}
