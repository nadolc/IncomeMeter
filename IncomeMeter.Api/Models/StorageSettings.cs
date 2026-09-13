namespace IncomeMeter.Api.Models;

public class StorageSettings
{
    /// <summary>"Local" (default, writes under LocalPath) or "AzureBlob".</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Directory for the Local provider. Relative paths resolve against the content root.</summary>
    public string LocalPath { get; set; } = "App_Data/uploads";

    public string? AzureBlobConnectionString { get; set; }
    public string AzureBlobContainer { get; set; } = "attachments";

    /// <summary>Maximum size per uploaded file in megabytes.</summary>
    public int MaxFileSizeMb { get; set; } = 20;

    /// <summary>Maximum number of files per batch upload.</summary>
    public int MaxFilesPerBatch { get; set; } = 100;
}
