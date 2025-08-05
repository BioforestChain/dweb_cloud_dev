# @dweb-cloud/safenv

A universal configuration, environment, and variable management library for Node.js projects.

## Features

- 🔧 **Universal Configuration**: Manage configurations, environment variables, and values (VAL) in a unified way
- 📁 **Multiple Formats**: Support for TS/JS/JSON/YAML configuration files using unconfig
- 🔌 **Plugin System**: Extensible plugin architecture with built-in plugins
- 📦 **File Generation**: Generate .env, JSON, YAML, TOML configuration files
- 🎯 **TypeScript Support**: Generate TypeScript validators and typed exports
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

1. Create a `safenv.config.ts` file:

```typescript
import { GenFilePlugin, GenTsPlugin } from '@dweb-cloud/safenv'
import type { SafenvConfig } from '@dweb-cloud/safenv'

const config: SafenvConfig = {
  name: 'my_project',
  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      required: true,
    },
    PORT: {
      type: 'number',
      default: 3000,
    },
    DATABASE_URL: {
      type: 'string',
      required: true,
    },
  },
  plugins: [
    new GenFilePlugin({
      name: 'my_project',
      formats: ['env', 'json'],
    }),
    new GenTsPlugin({
      outputPath: './src/config.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
    }),
  ],
}

export default config
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
