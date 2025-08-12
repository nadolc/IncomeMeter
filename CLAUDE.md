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
- **Route Management**: Create, track, and analyze driving routes
- **Income Tracking**: Monitor earnings from multiple sources (salary, freelance, etc.)
- **Dashboard Analytics**: Real-time charts and statistics
- **Multi-language Support**: English (UK) and Traditional Chinese (Hong Kong)
- **Currency Support**: GBP and HKD with proper formatting
- **Location Services**: GPS coordinate tracking and geocoding integration

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

### Backend Testing (Planned)
- Unit tests for services and controllers
- Integration tests with in-memory MongoDB
- API endpoint testing with TestServer

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
  "routes": { "title": "Routes", "status": {...}, ... },
  "auth": { "login": {...}, "logout": "Logout" },
  "dashboard": { "stats": {...}, "todayRoutes": {...} },
  "settings": { "preferences": {...}, "languages": {...} },
  "common": { "loading": "Loading...", ... },
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

**Route**:
```csharp
public class Route
{
    public string Id { get; set; }
    public string UserId { get; set; }
    public string? WorkType { get; set; }
    public RouteStatus Status { get; set; } // completed, in_progress, scheduled, cancelled
    public DateTime ScheduleStart { get; set; }
    public DateTime ScheduleEnd { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public List<IncomeSource> Incomes { get; set; }
    public decimal TotalIncome { get; set; }
    public decimal? EstimatedIncome { get; set; }
    public double Distance { get; set; }
    public double? StartMile { get; set; }
    public double? EndMile { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
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
```bash
# Development
ASPNETCORE_ENVIRONMENT=Development
FRONTEND_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:7079

# Production
ASPNETCORE_ENVIRONMENT=Production
FRONTEND_BASE_URL=https://incomemeter.com
API_BASE_URL=https://api.incomemeter.com
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

---

*This documentation serves as a comprehensive guide for regenerating the IncomeMeter project with identical architecture, dependencies, and deployment strategy.*