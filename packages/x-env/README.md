# @dweb-cloud/safenv

A universal configuration, environment, and variable management library for Node.js projects with complete type safety and Standard Schema compatibility.

## Features

- 🛡️ **Complete Type Safety**: Zero `any` types, full TypeScript support with compile-time validation
- 📋 **Standard Schema V1**: Generate schemas compatible with Zod, Valibot, ArkType, and other validation libraries
- 🔧 **Universal Configuration**: Manage configurations, environment variables, and values (VAL) in a unified way
- 🏗️ **Type-Safe Builders**: Use constraint builders and validators for robust configuration
- 📁 **Multiple Formats**: Support for TS/JS/JSON/YAML configuration files using unconfig
- 🔌 **Plugin System**: Extensible plugin architecture with built-in plugins
- 📦 **File Generation**: Generate .env, JSON, YAML, TOML configuration files
- 🎯 **Smart Constraints**: Rich constraint system with built-in validators
- 👁️ **Watch Mode**: Real-time configuration updates in serve mode
- 🏗️ **Build Mode**: One-time execution for CI/CD pipelines
- 🏢 **Workspace Support**: Manage multiple safenv configurations
- 🌐 **Web UI**: Optional web interface for configuration management

## Installation

```bash
npm install @dweb-cloud/safenv
# Optional peer dependency for Zod validation
npm install zod
```

## Quick Start

### Basic Usage

1. Create a `safenv.config.ts` file:

```typescript
import {
  defineConfig,
  stringVar,
  numberVar,
  constraints,
} from '@dweb-cloud/safenv'
import { GenTsPlugin } from '@dweb-cloud/safenv'

const config = defineConfig({
  name: 'my_project',
  variables: {
    NODE_ENV: stringVar({
      description: 'Node environment',
      default: 'development',
      constraints: constraints.string.nonEmpty(),
    }),
    PORT: numberVar({
      description: 'Server port',
      default: 3000,
      constraints: constraints.number.port(),
    }),
    DATABASE_URL: stringVar({
      description: 'Database connection URL',
      required: true,
      constraints: constraints.string.url(),
    }),
  },
  plugins: [
    new GenTsPlugin({
      outputPath: './src/config.ts',
      validatorStyle: 'pure', // Generates Standard Schema compatible code
      exportMode: 'process.env',
    }),
  ],
})

export default config
```

### Using with Validation Libraries

The generated Standard Schema works with any compatible validation library:

```typescript
// With Zod
import { z } from 'zod'
import { config } from './src/config'

const zodSchema = z.object({
  NODE_ENV: z.string(),
  PORT: z.number(),
  DATABASE_URL: z.string().url(),
})

const validatedConfig = zodSchema.parse(config)

// With Valibot
import * as v from 'valibot'

const valibotSchema = v.object({
  NODE_ENV: v.string(),
  PORT: v.number(),
  DATABASE_URL: v.pipe(v.string(), v.url()),
})

const validatedConfig = v.parse(valibotSchema, config)

// With ArkType
import { type } from 'arktype'

const arkTypeSchema = type({
  NODE_ENV: 'string',
  PORT: 'number',
  DATABASE_URL: 'string',
})

const validatedConfig = arkTypeSchema(config)
```

2. Run safenv:

```typescript
import { createServer, createBuilder } from '@dweb-cloud/safenv'

// Serve mode (with file watching)
const server = createServer()
await server.start()

// Build mode (one-time execution)
const builder = createBuilder()
await builder.build()
```

## Configuration

### Variable Types

- `string`: String values
- `number`: Numeric values
- `boolean`: Boolean values
- `array`: Array values (comma-separated in env)
- `object`: JSON object values

### Built-in Plugins

#### GenFilePlugin

Generates configuration files in various formats.

```typescript
new GenFilePlugin({
  name: 'my_project',
  formats: ['env', 'json', 'yaml', 'toml'],
  outputDir: './dist',
})
```

#### GenTsPlugin

Generates TypeScript validators and exports.

```typescript
new GenTsPlugin({
  outputPath: './src/config.ts',
  validatorStyle: 'zod', // or 'pure'
  exportMode: 'process.env', // or 'env-file', 'json-file', etc.
  exportName: 'config',
})
```

### Workspace Management

Manage multiple safenv configurations:

```typescript
// workspace.config.ts
export default {
  workspace: ['./packages/api', './packages/web', './packages/shared'],
}
```

## API Reference

### SafenvCore

Core safenv functionality.

```typescript
import { SafenvCore } from '@dweb-cloud/safenv'

const safenv = new SafenvCore({
  mode: 'build', // or 'serve'
  configFile: 'safenv.config',
  outputDir: './dist',
})

await safenv.run()
```

### SafenvServer

Development server with file watching.

```typescript
import { SafenvServer } from '@dweb-cloud/safenv'

const server = new SafenvServer({
  watch: true,
})

await server.start()
// Later...
await server.stop()
```

### SafenvBuilder

One-time build execution.

```typescript
import { SafenvBuilder } from '@dweb-cloud/safenv'

const builder = new SafenvBuilder()
await builder.build()
```

## License

MIT
