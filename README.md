# IncomeMeter - Project Architecture & Regeneration Guide

## 🎯 Project Overview

**IncomeMeter** is a comprehensive income tracking application designed for drivers to monitor their earnings from various routes and work types. The application features a modern React frontend with a .NET 9 Web API backend, deployed as a single containerized service to Azure App Service.

### 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + i18next (Internationalization)
- **Backend**: .NET 9 Web API + MongoDB + Azure Services Integration
- **Deployment**: Single service architecture via Docker containers on Azure App Service
- **CI/CD**: GitHub Actions with multi-environment deployment strategy
- **Testing**: Jest for frontend, planned unit tests for backend
- **Security**: JWT authentication with Google OAuth integration

---

## 📁 Project Structure

```
IncomeMeter/
├── .github/workflows/
│   └── ci-cd.yml                    # Complete CI/CD pipeline
├── IncomeMeter.Api/
│   ├── Controllers/                 # API Controllers (Auth, Dashboard, Routes, etc.)
│   ├── DTOs/                       # Data Transfer Objects
│   ├── Models/                     # Domain Models (User, Route, Transaction, etc.)
│   ├── Services/                   # Business Logic Layer
│   │   └── Interfaces/             # Service Interfaces
│   ├── Middleware/                 # Custom Middleware (Logging, Security, etc.)
│   ├── frontend/                   # React Frontend (Single Page App)
│   │   ├── src/
│   │   │   ├── components/         # React Components
│   │   │   │   ├── Auth/           # Authentication components
│   │   │   │   ├── Layout/         # Layout components (NavBar, etc.)
│   │   │   │   ├── Pages/          # Page components (Dashboard, Routes, etc.)
│   │   │   │   └── Common/         # Shared components
│   │   │   ├── contexts/           # React Context Providers
│   │   │   ├── i18n/               # Internationalization setup
│   │   │   │   └── locales/        # Translation files (en-GB, zh-HK)
│   │   │   ├── types/              # TypeScript type definitions
│   │   │   ├── utils/              # Utility functions
│   │   │   └── __tests__/          # Test files
│   │   ├── jest.config.js          # Jest testing configuration
│   │   ├── tailwind.config.js      # TailwindCSS configuration
│   │   └── vite.config.ts          # Vite build configuration
│   ├── Program.cs                  # Application entry point
│   ├── appsettings.json           # Configuration settings
│   └── IncomeMeter.Api.csproj     # .NET project file
├── azure/                          # Azure infrastructure
│   ├── bicep/                      # Infrastructure as Code
│   └── parameters/                 # Environment-specific parameters
├── migration/                      # Database migration tools
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml             # Local development setup
└── IncomeMeter.sln                # Solution file
```

---

## 🚀 Technology Stack

### Backend (.NET 9 Web API)
```xml
<!-- Key NuGet Packages -->
<PackageReference Include="MongoDB.Driver" Version="3.4.2" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="9.0.8" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.Google" Version="9.0.8" />
<PackageReference Include="Google.Apis.Gmail.v1" Version="1.70.0.3833" />
<PackageReference Include="Serilog.AspNetCore" Version="8.0.3" />
<PackageReference Include="Azure.Extensions.AspNetCore.Configuration.Secrets" Version="1.4.0" />
<PackageReference Include="Microsoft.ApplicationInsights.AspNetCore" Version="2.22.0" />
```

### Frontend (React 18 + TypeScript)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.27.0",
    "axios": "^1.7.9",
    "i18next": "^23.16.8",
    "react-i18next": "^13.5.0",
    "i18next-browser-languagedetector": "^8.2.0",
    "chart.js": "^4.4.6",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.7.0",
    "typescript": "~5.8.3",
    "tailwindcss": "^3.4.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.2",
    "eslint": "^9.32.0"
  }
}
```

---

## 🎨 Key Features

### Core Functionality
- **Route Management**: Full CRUD operations for driving routes with filtering and date range queries
- **Location Tracking**: Complete location management with GPS coordinates, geocoding, and distance calculations
- **Income Tracking**: Monitor earnings from multiple sources with detailed breakdown
- **Dashboard Analytics**: Real-time charts and statistics
- **Multi-language Support**: English (UK) and Traditional Chinese (Hong Kong) with comprehensive localization
- **Currency Support**: GBP and HKD with proper formatting
- **Advanced Filtering**: Filter routes by status, date range, and work type
- **Geolocation Services**: GPS coordinate tracking, reverse geocoding, and distance validation

### Authentication & Security
- Google OAuth 2.0 integration
- JWT token-based authentication
- Azure Key Vault for secrets management
- Security logging middleware
- API key authentication for internal services

### User Experience
- Responsive design with mobile-first approach
- Dark/light mode support (planned)
- Progressive Web App capabilities (planned)
- Offline functionality (planned)

---

## 🔧 Development Setup

### Prerequisites
```bash
# Required software
- .NET 9 SDK
- Node.js 18+
- Docker & Docker Compose
- Azure CLI (for deployment)
- MongoDB (for local development)
```

### Local Development Commands
```bash
# Backend API
dotnet restore IncomeMeter.sln
dotnet build IncomeMeter.sln
dotnet run --project IncomeMeter.Api

# Frontend
cd IncomeMeter.Api/frontend
npm install
npm run dev              # Development server
npm run build           # Production build
npm run lint            # ESLint
npm run test            # Jest tests
npm run test:coverage   # Coverage report

# Docker (Full stack)
docker-compose up --build
```

---

## 🧪 Testing Strategy

### Frontend Testing (Jest + React Testing Library)
- **Unit Tests**: Component testing with comprehensive mocks
- **Integration Tests**: Context providers and API integration
- **Coverage Target**: >80% code coverage
- **Configuration**: `jest.config.js` with jsdom environment

**Key Test Files**:
```
frontend/src/
├── components/Layout/__tests__/NavBar.test.tsx
├── contexts/__tests__/AuthContext.test.tsx
├── utils/__tests__/api.test.ts
└── App.test.tsx
```

### Backend Testing (xUnit + Moq + FluentAssertions)
- **Service Tests**: Complete unit tests for RouteService and LocationService with MongoDB mocking
- **Controller Tests**: Integration tests for RoutesController and LocationsController with authentication
- **Test Coverage**: Comprehensive coverage of CRUD operations, error handling, and business logic
- **Test Configuration**: Uses xUnit, Moq for mocking, and FluentAssertions for readable assertions

---

## 🌍 Internationalization (i18n)

### Supported Languages
- **English (UK)** - `en-GB`
- **Traditional Chinese (Hong Kong)** - `zh-HK`

### Translation Structure
```json
{
  "app": { "title": "Income Meter", "subtitle": "..." },
  "navigation": { "dashboard": "Dashboard", ... },
  "routes": { 
    "title": "Routes", 
    "status": {...}, 
    "crud": { "create": {...}, "edit": {...}, "delete": {...} },
    "actions": { "start": "Start Route", "end": "End Route", ... },
    "filters": { "all": "All Routes", "scheduled": "Scheduled", ... }
  },
  "locations": {
    "title": "Locations",
    "crud": { "create": {...}, "edit": {...}, "delete": {...} },
    "details": { "coordinates": "Coordinates", "address": "Address", ... },
    "map": { "title": "Route Map", ... }
  },
  "auth": { "login": {...}, "logout": "Logout" },
  "dashboard": { "stats": {...}, "todayRoutes": {...} },
  "settings": { "preferences": {...}, "languages": {...} },
  "common": { "loading": "Loading...", "success": "Success", ... },
  "errors": { "generic": "Something went wrong...", ... }
}
```

---

## 🐳 Containerization

### Single Service Docker Architecture
The application uses a multi-stage Dockerfile that builds both frontend and backend into a single container for Azure App Service deployment.

**Build Stages**:
1. **build-backend**: .NET 9 SDK builds the API
2. **build-frontend**: Node.js 18 builds React app with Vite
3. **runtime**: ASP.NET Core 9.0 serves both API and static files

**Key Configuration**:
```dockerfile
# Azure App Service specific settings
ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 80
```

---

## ☁️ Azure Deployment

### Infrastructure Components
- **Azure App Service**: Container hosting
- **Azure Key Vault**: Secrets management
- **Application Insights**: Monitoring and analytics
- **Azure Container Registry**: Image storage
- **MongoDB Atlas**: Database (cloud-hosted)

### Environment Strategy
- **Development**: `develop` branch → Auto-deploy
- **Staging**: `main` branch → Auto-deploy
- **Production**: Manual deployment via workflow dispatch

### Required Azure Secrets
```yaml
# GitHub Secrets needed for deployment
AZURE_CREDENTIALS_DEV      # Service principal for dev environment
AZURE_CREDENTIALS_STAGING  # Service principal for staging environment
AZURE_CREDENTIALS_PROD     # Service principal for production environment
AZURE_RG_DEV              # Resource group name for dev
AZURE_RG_STAGING          # Resource group name for staging
AZURE_RG_PROD             # Resource group name for production
SLACK_WEBHOOK             # Deployment notifications (optional)
```

---

## 📋 Data Models

### Core Entities

**User**:
```csharp
public class User
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**Route** (Enhanced with full CRUD support):
```csharp
public class Route
{
    public string Id { get; set; }
    public string UserId { get; set; }
    public string? WorkType { get; set; }
    public string Status { get; set; } // completed, in_progress, scheduled, cancelled
    public DateTime ScheduleStart { get; set; }
    public DateTime ScheduleEnd { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public List<IncomeItem> Incomes { get; set; }
    public decimal TotalIncome { get; set; }
    public decimal EstimatedIncome { get; set; }
    public double Distance { get; set; }
    public double? StartMile { get; set; }
    public double? EndMile { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**Location** (New entity for GPS tracking):
```csharp
public class Location
{
    public string Id { get; set; }
    public string RouteId { get; set; }
    public string UserId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Address { get; set; }
    public double? Speed { get; set; }
    public double? Accuracy { get; set; }
    public double? DistanceFromLastKm { get; set; }
    public double? DistanceFromLastMi { get; set; }
}
```

**UserSettings**:
```typescript
interface UserSettings {
  currency: 'GBP' | 'HKD';
  language: 'en-GB' | 'zh-HK';
  timeZone: string;
  dateFormat: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  defaultChartPeriod: string;
  showWeekends: boolean;
  mileageUnit: 'km' | 'mi';
}
```

### API Endpoints

#### Route Management
- `GET /api/routes` - Get all routes for authenticated user
- `GET /api/routes/{id}` - Get specific route by ID
- `GET /api/routes/status/{status}` - Get routes by status (completed, in_progress, scheduled, cancelled)
- `GET /api/routes/date-range?startDate={start}&endDate={end}` - Get routes within date range
- `POST /api/routes` - Create new scheduled route
- `POST /api/routes/start` - Start a new route immediately
- `POST /api/routes/end` - End an active route
- `PUT /api/routes/{id}` - Update existing route
- `DELETE /api/routes/{id}` - Delete route

#### Location Management
- `GET /api/locations?routeId={routeId}` - Get all locations for a route
- `GET /api/locations/{id}` - Get specific location by ID
- `POST /api/locations` - Add new location point
- `PUT /api/locations/{id}` - Update existing location
- `DELETE /api/locations/{id}` - Delete specific location
- `DELETE /api/locations/route/{routeId}` - Delete all locations for a route

#### Data Transfer Objects
**Route DTOs**: `CreateRouteDto`, `UpdateRouteDto`, `StartRouteDto`, `EndRouteDto`, `RouteResponseDto`

**Location DTOs**: `CreateLocationDto`, `UpdateLocationDto`, `LocationDto`, `LocationResponseDto`

---

## 🔐 Security Implementation

### Authentication Flow
1. User clicks "Continue with Google"
2. Redirected to Google OAuth consent screen
3. Google redirects back with authorization code
4. Backend exchanges code for user info and generates JWT
5. Frontend stores JWT in localStorage
6. All API calls include JWT in Authorization header

### Security Middleware
- **Global Exception Handler**: Centralized error handling
- **Request Logging**: Audit trail for all requests
- **Security Headers**: CORS, HSTS, Content Security Policy
- **API Key Authentication**: For internal service calls

---

## 🚦 CI/CD Pipeline

### Pipeline Stages
1. **Build & Test**: 
   - .NET API build and tests
   - React frontend lint and Jest tests
   - Security scanning with Trivy
2. **Container Build**: Multi-stage Docker build and push to GHCR
3. **Deployment**:
   - Development (auto on develop branch)
   - Staging (auto on main branch)
   - Production (manual approval)
4. **Post-Deployment**: Smoke tests and notifications

### Quality Gates
- All tests must pass
- ESLint must pass with zero errors
- Security scan must complete
- Container build must succeed
- Deployment health checks must pass

---

## 🔄 Migration & Data Management

### Database Migration Tools
Located in `migration/` directory:
- **MigrationTool**: General purpose data migration
- **MongoToCosmosMongoAPI**: Azure Cosmos DB migration
- **SingleUserMigration**: User-specific data migration
- **nodejs-migration**: Node.js based migration scripts

---

## 📖 Development Guidelines

### Code Standards
- **Backend**: Follow .NET naming conventions, use async/await pattern
- **Frontend**: Use functional components with hooks, TypeScript strict mode
- **Testing**: Minimum 80% coverage, meaningful test descriptions
- **Git**: Conventional commits, feature branches, PR reviews required

### Environment Variables

#### Backend (.NET API)
```bash
# Development
ASPNETCORE_ENVIRONMENT=Development

# Production
ASPNETCORE_ENVIRONMENT=Production
```

#### Frontend (React/Vite)
```bash
# Development (automatic)
# Uses localhost:7079 for API calls

# Production (Azure App Service)
VITE_API_BASE_URL=https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net
```

#### Google OAuth Configuration
**Authorized Redirect URIs:**
```
https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net/signin-google (production)
https://localhost:7079/signin-google (development)
```

**Authorized JavaScript Origins:**
```
https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net (production)
https://localhost:7079 (development)
http://localhost:5173 (development)
```

---

## 🎯 Regeneration Instructions for Claude

To recreate this project structure:

1. **Initialize Solution**:
   ```bash
   dotnet new sln -n IncomeMeter
   dotnet new webapi -n IncomeMeter.Api -f net9.0
   dotnet sln add IncomeMeter.Api
   ```

2. **Setup Frontend**:
   ```bash
   cd IncomeMeter.Api
   npm create vite@latest frontend -- --template react-ts
   cd frontend && npm install [dependencies from package.json]
   ```

3. **Configure Docker**: Create multi-stage Dockerfile as specified above

4. **Setup CI/CD**: Create `.github/workflows/ci-cd.yml` with the pipeline configuration

5. **Implement Core Features**: Follow the architectural patterns and technology choices outlined in this document

6. **Configure Azure**: Setup Azure resources using the Bicep templates in `azure/` directory

### Key Implementation Notes
- Use the exact NuGet packages and npm dependencies specified
- Implement the React Context pattern for state management
- Follow the single service deployment model
- Maintain the i18n structure for multi-language support
- Preserve the testing configuration and mock strategies
- Implement full CRUD operations for both Routes and Locations
- Use comprehensive error handling and logging throughout
- Maintain proper authentication and authorization for all endpoints
- Follow the established patterns for DTOs and service interfaces

---

## 📋 Future Development Phases

### **Phase 2: Organization Foundation (Q2 2025)**
**Goal**: Multi-tenancy and basic organization structure

#### Enhanced Data Models
```csharp
public class Organization
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public OrganizationType Type { get; set; }
    
    // Subscription & limits
    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Free;
    public int MaxUsers { get; set; } = 1;
    public int MaxWorkTypes { get; set; } = 10;
    
    // Settings
    public OrganizationSettings Settings { get; set; } = new();
    
    public string OwnerId { get; set; }
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum OrganizationType
{
    Individual = 0,     // Single user (current)
    Team = 1,          // Small team (2-10 users)
    Company = 2,       // Medium company (11-100 users)
    Enterprise = 3     // Large enterprise (100+ users)
}

public enum SubscriptionPlan
{
    Free = 0,          // Individual only
    Team = 1,          // Up to 10 users
    Business = 2,      // Up to 100 users
    Enterprise = 3     // Unlimited users
}

public class OrganizationSettings
{
    public string DefaultCurrency { get; set; } = "GBP";
    public string DefaultLanguage { get; set; } = "en-GB";
    public string TimeZone { get; set; } = "Europe/London";
    public bool RequireApprovalForNewUsers { get; set; } = false;
    public bool AllowUserCreateWorkTypes { get; set; } = true;
}
```

#### Enhanced User Model
```csharp
public class User // Phase 2 Enhancement
{
    // ... existing properties ...
    
    // Organization membership
    public string? OrganizationId { get; set; }
    public string? RoleId { get; set; } // Custom role within organization
    public UserRole SystemRole { get; set; } = UserRole.Member;
    
    // Team/department (future)
    public string? DepartmentId { get; set; }
    public string? ManagerId { get; set; }
    
    // Status
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTime? LastLoginAt { get; set; }
    
    // Invitation flow
    public string? InviteToken { get; set; }
    public DateTime? InviteExpiresAt { get; set; }
    public bool IsInvitePending { get; set; } = false;
}

public enum UserStatus
{
    Active = 0,
    Inactive = 1,
    Suspended = 2,
    PendingInvitation = 3
}
```

#### Multi-tenancy Implementation
```csharp
// Tenant-aware base repository
public abstract class TenantAwareRepository<T>
{
    protected async Task<List<T>> GetByOrganizationAsync(string? organizationId)
    {
        var filter = organizationId == null 
            ? Builders<T>.Filter.Eq("OrganizationId", BsonNull.Value)
            : Builders<T>.Filter.Eq("OrganizationId", organizationId);
            
        return await _collection.Find(filter).ToListAsync();
    }
}

// Middleware for tenant context
public class TenantContextMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var user = await GetCurrentUserAsync(context);
        if (user != null)
        {
            context.Items["TenantId"] = user.OrganizationId;
            context.Items["UserId"] = user.Id;
        }
        
        await next(context);
    }
}
```

### **Phase 3: Enterprise Features (Q3-Q4 2025)**
**Goal**: Complete organization management and permissions

#### Permission System
```csharp
public class Permission
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public PermissionCategory Category { get; set; }
    public string ResourceType { get; set; } // "Route", "WorkType", "User", etc.
    public List<string> Actions { get; set; } = new(); // ["Create", "Read", "Update", "Delete"]
}

public enum PermissionCategory
{
    Routes = 0,
    WorkTypes = 1,
    Users = 2,
    Organization = 3,
    Reports = 4,
    Settings = 5
}

public class Role
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string OrganizationId { get; set; }
    public List<string> PermissionIds { get; set; } = new();
    public bool IsSystemRole { get; set; } = false;
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Built-in system roles
public static class SystemRoles
{
    public static readonly Role Member = new()
    {
        Name = "Member",
        Description = "Standard user - can manage own routes and work types",
        IsSystemRole = true,
        PermissionIds = new() { "routes:crud", "worktypes:crud:own" }
    };
    
    public static readonly Role Manager = new()
    {
        Name = "Manager", 
        Description = "Can view team data and manage work types",
        IsSystemRole = true,
        PermissionIds = new() { "routes:crud", "routes:read:team", "worktypes:crud" }
    };
    
    public static readonly Role Admin = new()
    {
        Name = "Admin",
        Description = "Full organization access",
        IsSystemRole = true,
        PermissionIds = new() { "*" } // All permissions
    };
}
```

#### User Management Features
```csharp
public class UserInvitationService
{
    public async Task<UserInvitation> InviteUserAsync(string organizationId, string email, string roleId)
    {
        var invitation = new UserInvitation
        {
            OrganizationId = organizationId,
            Email = email,
            RoleId = roleId,
            Token = GenerateSecureToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            Status = InvitationStatus.Pending
        };
        
        await _invitations.InsertOneAsync(invitation);
        await SendInvitationEmailAsync(invitation);
        
        return invitation;
    }
    
    public async Task<User> AcceptInvitationAsync(string token, CreateUserRequest request)
    {
        var invitation = await ValidateInvitationTokenAsync(token);
        
        var user = await _userService.CreateUserAsync(
            request.GoogleId, 
            request.Email, 
            request.DisplayName);
            
        user.OrganizationId = invitation.OrganizationId;
        user.RoleId = invitation.RoleId;
        user.Status = UserStatus.Active;
        
        await _userService.UpdateAsync(user);
        await MarkInvitationAcceptedAsync(invitation.Id);
        
        return user;
    }
}
```

#### Department & Team Structure
```csharp
public class Department
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string OrganizationId { get; set; }
    public string? ParentDepartmentId { get; set; } // Hierarchical departments
    public string? ManagerId { get; set; }
    
    // Budget and limits
    public decimal? MonthlyBudget { get; set; }
    public int? MaxUsers { get; set; }
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Team
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string OrganizationId { get; set; }
    public string? DepartmentId { get; set; }
    public string LeaderId { get; set; }
    
    public List<string> MemberIds { get; set; } = new();
    public TeamSettings Settings { get; set; } = new();
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

### **Migration Strategy**

#### Phase 1 → Phase 2 Migration
```csharp
public class Phase2MigrationService
{
    public async Task MigrateToMultiTenantAsync()
    {
        // 1. Create default organization for existing users
        var individualUsers = await _users.Find(u => u.OrganizationId == null).ToListAsync();
        
        foreach (var user in individualUsers)
        {
            // Create personal organization for existing users
            var personalOrg = new Organization
            {
                Name = $"{user.DisplayName}'s Organization",
                Type = OrganizationType.Individual,
                Plan = SubscriptionPlan.Free,
                OwnerId = user.Id,
                Settings = new OrganizationSettings
                {
                    DefaultCurrency = user.Settings.CurrencyCode,
                    DefaultLanguage = user.Settings.Language
                }
            };
            
            await _organizations.InsertOneAsync(personalOrg);
            
            // Update user to belong to personal organization
            await _users.UpdateOneAsync(
                u => u.Id == user.Id,
                Builders<User>.Update.Set(u => u.OrganizationId, personalOrg.Id));
            
            // Migrate user's work types to organization scope
            await MigrateUserWorkTypesToOrganizationAsync(user.Id, personalOrg.Id);
        }
    }
}
```

#### Database Schema Evolution
```javascript
// MongoDB migration scripts for Phase 2
db.users.updateMany(
    { organizationId: { $exists: false } },
    { 
        $set: { 
            organizationId: null,
            roleId: null,
            status: 0, // Active
            lastLoginAt: null
        }
    }
);

db.workTypeConfigs.updateMany(
    { organizationId: { $exists: false } },
    {
        $set: {
            organizationId: null,
            scope: 0 // Individual
        }
    }
);

// Add indexes for multi-tenancy
db.routes.createIndex({ "userId": 1, "organizationId": 1 });
db.workTypeConfigs.createIndex({ "organizationId": 1, "isActive": 1 });
db.users.createIndex({ "organizationId": 1, "status": 1 });
```

### **Frontend Enhancements**

#### Organization Management UI
```typescript
// Organization dashboard component
interface OrganizationDashboard {
  organization: Organization;
  users: User[];
  departments: Department[];
  teams: Team[];
  analytics: OrganizationAnalytics;
}

// User invitation flow
interface InviteUserForm {
  email: string;
  roleId: string;
  departmentId?: string;
  teamId?: string;
  message?: string;
}

// Permission-aware components
const ProtectedComponent: React.FC<{ permission: string; children: React.ReactNode }> = 
  ({ permission, children }) => {
    const { hasPermission } = usePermissions();
    return hasPermission(permission) ? <>{children}</> : null;
  };
```

#### Multi-tenant Routing
```typescript
// Tenant-aware API client
class ApiClient {
  constructor(private organizationId?: string) {}
  
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.getToken()}`,
    };
    
    if (this.organizationId) {
      headers['X-Organization-Id'] = this.organizationId;
    }
    
    return headers;
  }
}

// Organization context provider
const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  
  return (
    <OrganizationContext.Provider value={{
      organization: currentOrganization,
      permissions: userPermissions,
      switchOrganization: setCurrentOrganization
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};
```

### **Implementation Timeline**

#### Phase 2 Milestones (6 months)
- **Month 1-2**: Organization models and multi-tenancy foundation
- **Month 3-4**: Basic role system and user management
- **Month 5-6**: Organization dashboard and user invitation flow

#### Phase 3 Milestones (6 months)
- **Month 1-2**: Advanced permission system and custom roles
- **Month 3-4**: Department/team structure and hierarchy
- **Month 5-6**: Enterprise features (analytics, billing, compliance)

### **Benefits of Phased Approach**

1. **Non-Breaking Evolution**: Each phase maintains backward compatibility
2. **Incremental Value**: Users get benefits at each phase completion
3. **Risk Mitigation**: Smaller, manageable changes reduce deployment risk
4. **Market Feedback**: Real user feedback guides feature prioritization
5. **Resource Planning**: Clear milestones enable better resource allocation

---

*This documentation serves as a comprehensive guide for regenerating the IncomeMeter project with identical architecture, dependencies, and deployment strategy.*
