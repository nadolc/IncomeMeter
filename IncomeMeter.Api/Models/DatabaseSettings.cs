namespace IncomeMeter.Api.Models
{
    public class DatabaseSettings
    {
        public string ConnectionString { get; set; } = null!;
        public string DatabaseName { get; set; } = null!;
        public string UsersCollectionName { get; set; } = null!;
        public string RoutesCollectionName { get; set; } = null!;
        public string LocationsCollectionName { get; set; } = null!;
        public string TransactionsCollectionName { get; set; } = null!;
    }
}
