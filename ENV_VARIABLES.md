# Environment Variables Configuration

This document lists all required environment variables for the application.

## Setup

1. Copy the example below to your `.env.local` file
2. Replace placeholder values with your actual credentials
3. Never commit `.env.local` to version control

## Required Environment Variables

### Google Drive API

```env
# Service Account (Recommended)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# OR OAuth2 Client Credentials (Alternative)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token

# Legacy API Key (optional, for public folders only)
GOOGLE_DRIVE_API_KEY=your_api_key_here
```

### MongoDB - Main Database

```env
MONGODB_URI=mongodb://username:password@host:port/database?options
MONGODB_DATABASE_NAME=ERP
MONGODB_SSL=false
MONGODB_READ_PREFERENCE=primary
```

### MongoDB - CNC Genie Database

```env
MONGODB_CNC_URI=mongodb://username:password@host:port/database?authSource=admin
MONGODB_CNC_DATABASE_NAME=CNC_GENIE
MONGODB_CNC_SSL=false
MONGODB_CNC_READ_PREFERENCE=primary
```

### Redis Cache (Optional but Recommended)

```env
# Redis connection string (optional - defaults to localhost:6379)
REDIS_URL=redis://localhost:6379
# OR
REDIS_CONNECTION_STRING=redis://username:password@host:port

# For Redis Cloud or other providers:
# REDIS_URL=rediss://username:password@host:port (note: rediss:// for SSL)
```

## Notes

- All MongoDB connection strings are now stored in environment variables for security
- The application will throw an error on startup if required MongoDB variables are missing
- Google Drive service account key should be a JSON string (double-stringified for .env files)
- **Redis is optional** - The application will work without Redis, but caching will be disabled
- Redis significantly improves performance by caching:
  - Device settings (24 hour cache)
  - Graph data queries (1-24 hours depending on date)
  - Generated images (6 hour cache)
- If Redis is not available, the app will gracefully degrade and continue working without caching








