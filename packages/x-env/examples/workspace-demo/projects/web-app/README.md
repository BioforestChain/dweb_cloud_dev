# Web App

Web application that demonstrates @dweb-cloud/safenv's `autoDependencies` feature by depending on the base-service project.

## Features

- **Auto Dependencies**: Automatically discovers and imports configuration from base-service
- **Web Server**: Mock web server with configurable features
- **API Client**: HTTP client for communicating with base service
- **Feature Toggles**: Enable/disable authentication and analytics
- **Configuration Override**: Can override base-service configuration using prefixed environment variables

## Configuration

The web-app uses its own environment variables and automatically inherits configuration from base-service through the `autoDependencies` feature.

### Web App Specific Variables

- `APP_PORT`: Web application port (default: 3001)
- `APP_NAME`: Application name (default: "Web App")
- `API_BASE_URL`: Base service API URL (default: "http://localhost:3000")
- `API_TIMEOUT`: API request timeout in milliseconds (default: 5000)
- `ENABLE_AUTH`: Enable authentication (default: true)
- `ENABLE_ANALYTICS`: Enable analytics tracking (default: false)
- `STATIC_PATH`: Static files path (default: "./public")
- `MAX_UPLOAD_SIZE`: Maximum upload size in bytes (default: 10485760)

### Base Service Dependencies

Through `autoDependencies`, this project automatically inherits all base-service configuration variables with the `BASE_SERVICE_` prefix:

- `BASE_SERVICE_DB_HOST`
- `BASE_SERVICE_DB_PORT`
- `BASE_SERVICE_DB_NAME`
- `BASE_SERVICE_DB_USER`
- `BASE_SERVICE_DB_PASSWORD`
- `BASE_SERVICE_REDIS_URL`
- `BASE_SERVICE_REDIS_TTL`
- `BASE_SERVICE_SERVICE_PORT`
- `BASE_SERVICE_LOG_LEVEL`

## Setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

## Usage

### Development Mode

```bash
pnpm dev
```

### Production Mode

```bash
pnpm start
```

## Dependencies

This project depends on:

- `base-service`: Provides database and Redis configuration
- `@dweb-cloud/safenv`: Environment variable management with auto-dependencies
- `zod`: Schema validation

## Architecture

The web-app demonstrates how to:

1. Use `autoDependencies: true` to automatically discover workspace dependencies
2. Import and use configuration from other projects
3. Define project-specific environment variables
4. Override dependency configuration using prefixed variables
5. Maintain type safety across project boundaries
