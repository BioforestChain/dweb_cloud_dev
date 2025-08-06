# Base Service

A foundational service that demonstrates @dweb-cloud/safenv usage with database and Redis configuration.

## Features

- Database connection management with PostgreSQL
- Redis caching with configurable TTL
- Type-safe environment variable configuration
- Exportable configuration for other services

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### Database Configuration

- `DB_HOST` - Database host address (default: localhost)
- `DB_PORT` - Database port number (default: 5432)
- `DB_NAME` - Database name (default: baseservice)
- `DB_USER` - Database username (required)
- `DB_PASSWORD` - Database password (required, min 8 characters)

### Redis Configuration

- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `REDIS_TTL` - Default TTL in seconds (default: 3600)

### Service Configuration

- `SERVICE_PORT` - HTTP service port (default: 3000)
- `LOG_LEVEL` - Logging level: error, warn, info, debug (default: info)

## Usage

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode
pnpm dev

# Run production build
pnpm start
```

## Configuration Export

This service exports its configuration for use by other projects:

```typescript
import { BaseServiceConfig, BaseServiceConfigType } from 'base-service'

// Use the configuration
console.log(BaseServiceConfig.DB_HOST)
```

## API

### BaseService Class

```typescript
import { BaseService } from 'base-service'

const service = new BaseService()
const { database, cache, config } = await service.start()
```

The service provides:

- `database` - Database connection interface
- `cache` - Redis client interface
- `config` - Validated configuration object
