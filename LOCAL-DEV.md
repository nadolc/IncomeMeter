# Running IncomeMeter locally

```
start-local.bat
```

Starts the API (`https://localhost:7079`) and the web frontend (`http://localhost:5173`) in two windows and opens `/expenses`.

## Secrets

The API reads its local configuration from **`IncomeMeter.Api/appsettings.Development.json`** (git-ignored).
The `.env.template` at the repo root is for the *deployed* app (Azure App Settings use the `Section__Key` form) – the API does not load a `.env` file locally.

First-time setup:

```
copy IncomeMeter.Api\appsettings.Development.template.json IncomeMeter.Api\appsettings.Development.json
```

then fill in:

| Key in `appsettings.Development.json` | Required | Where to get it |
|---|---|---|
| `Development:MongoConnectionString` and `DatabaseSettings:ConnectionString` | **Yes** | Azure Portal → Cosmos DB for MongoDB (vCore) → Connection strings. Your IP must be allowed under *Networking*. |
| `Development:MongoDatabaseName` and `DatabaseSettings:DatabaseName` | **Yes** | e.g. `incomemterdev` |
| `Development:JwtSecret` and `Jwt:SecretKey` | **Yes** | Any random string ≥ 32 chars (both keys must hold the same value). Generate: `powershell -c "[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))"` |
| `Development:GoogleClientId` / `Development:GoogleClientSecret` | Yes for Google login | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web). Add `https://localhost:7079/api/auth/google-callback` as an authorised redirect URI. |
| `Development:OpenCageApiKey` | For address geocoding | https://opencagedata.com |
| `Development:OpenRouteServiceApiKey` | For route distances | https://openrouteservice.org |
| `KeyVault:VaultUri`, `AzureAd:TenantId`, `AzureAd:ClientId` | No (leave placeholders, `Development:UseKeyVault` is `false`) | Only used when Key Vault is enabled |

### New sections added by the expenses / receipts feature

| Key | Default | Notes |
|---|---|---|
| `Storage:Provider` | `Local` | `Local` writes receipts to `IncomeMeter.Api/App_Data/uploads` (git-ignored). Set `AzureBlob` for a shared/persistent store. |
| `Storage:AzureBlobConnectionString` | empty | Required only when `Provider` = `AzureBlob`. Azure Portal → Storage account → Access keys. |
| `Storage:AzureBlobContainer` | `attachments` | Created automatically (private). |
| `Ocr:Enabled` | `false` | Optional receipt OCR (merchant / date / total pre-fill). |
| `Ocr:Endpoint` / `Ocr:ApiKey` | empty | Azure AI Document Intelligence resource → Keys and Endpoint. Only needed when `Ocr:Enabled` is `true`. |
| `TaxRules:*` | see `appsettings.json` | HMRC rates used by the tax-year report (45p/25p mileage, 18% / 6% WDA, CO2 threshold 50, 100% FYA). Override here if HMRC changes them. |

Nothing in the new sections is required to run locally – with the defaults, receipts are stored on disk and OCR is off.

## Frontend

`IncomeMeter.Api/frontend/.env` (git-ignored) is optional. In dev the app calls `https://localhost:7079` unless `VITE_API_BASE_URL` is set.

## Deploying (Azure App Service → Configuration → Application settings)

Same keys, in env-var form (`:` → `__`). The ones added by this feature:

```
Storage__Provider=AzureBlob
Storage__AzureBlobConnectionString=<storage account connection string>
Storage__AzureBlobContainer=attachments
Ocr__Enabled=false            # or true + the two below
Ocr__Endpoint=
Ocr__ApiKey=
```
