using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IncomeMeter.Api.Tests.Services
{
    public class FakeMongoDbContext : MongoDbContext
    {
        public FakeMongoDbContext(IMongoCollection<User> users)
            : base(Options.Create(new DatabaseSettings
            {
                ConnectionString = "mongodb://localhost:27017",
                DatabaseName = "FakeDb",
                UsersCollectionName = "users",
                RoutesCollectionName = "routes",
                LocationsCollectionName = "locations",
                TransactionsCollectionName = "transactions"
            }))
        {
            // Override Users with the mock
            Users = users;
        }

        // override properties so we can inject mocks if needed
        public override IMongoCollection<User> Users { get; }
    }

}
