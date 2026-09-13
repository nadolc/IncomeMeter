using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Services.Storage;

/// <summary>
/// Stores files in a private Azure Blob Storage container. Used when Storage:Provider == "AzureBlob".
/// </summary>
public class AzureBlobStorageService : IFileStorageService
{
    private readonly BlobContainerClient _container;

    public AzureBlobStorageService(IOptions<StorageSettings> settings)
    {
        var s = settings.Value;
        if (string.IsNullOrWhiteSpace(s.AzureBlobConnectionString))
            throw new InvalidOperationException("Storage:AzureBlobConnectionString is required when Storage:Provider is AzureBlob");

        _container = new BlobContainerClient(s.AzureBlobConnectionString, s.AzureBlobContainer);
        _container.CreateIfNotExists(PublicAccessType.None);
    }

    public async Task<string> SaveAsync(string storageKey, Stream content, string contentType, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(storageKey);
        await blob.UploadAsync(content, new BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);
        return storageKey;
    }

    public async Task<Stream?> OpenReadAsync(string storageKey, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(storageKey);
        try
        {
            return await blob.OpenReadAsync(cancellationToken: ct);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task DeleteAsync(string storageKey, CancellationToken ct = default)
    {
        await _container.GetBlobClient(storageKey).DeleteIfExistsAsync(cancellationToken: ct);
    }
}
