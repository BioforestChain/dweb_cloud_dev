import { defineConfig } from '../../src/config-builder.ts'

export default defineConfig({
  name: 'workspace-demo',
  description: 'Workspace-level configuration for the demo project',
  variables: {
    // Global database configuration
    DB_HOST: {
      type: 'string',
      description: 'Global database host address',
      default: 'localhost',
      required: true,
      constraints: {
        minLength: 1,
      },
    },
    DB_PORT: {
      type: 'number',
      description: 'Global database port number',
      default: 5432,
      required: true,
      constraints: {
        min: 1,
        max: 65535,
        integer: true,
      },
    },
    DB_NAME: {
      type: 'string',
      description: 'Global database name',
      default: 'workspace_demo',
      required: true,
      constraints: {
        pattern: /^[a-zA-Z0-9_]+$/,
        minLength: 1,
        maxLength: 64,
      },
    },
    DB_USER: {
      type: 'string',
      description: 'Global database username',
      required: true,
      constraints: {
        minLength: 1,
      },
    },
    DB_PASSWORD: {
      type: 'string',
      description: 'Global database password',
      required: true,
      constraints: {
        minLength: 8,
      },
    },
    // Global Redis configuration
    REDIS_URL: {
      type: 'string',
      description: 'Global Redis connection URL',
      default: 'redis://localhost:6379',
      constraints: {
        pattern: /^redis:\/\/.+/,
      },
    },
    REDIS_TTL: {
      type: 'number',
      description: 'Global Redis default TTL in seconds',
      default: 3600,
      constraints: {
        min: 1,
        integer: true,
      },
    },
    // Global logging configuration
    LOG_LEVEL: {
      type: 'string',
      description: 'Global logging level',
      default: 'info',
      validate: (
        value: string | number | boolean | Record<string, unknown> | unknown[]
      ) => {
        if (typeof value !== 'string') return 'Must be a string'
        const levels = ['error', 'warn', 'info', 'debug']
        return levels.includes(value)
          ? true
          : `Must be one of: ${levels.join(', ')}`
      },
    },
    // Environment settings
    NODE_ENV: {
      type: 'string',
      description: 'Node.js environment',
      default: 'development',
      validate: (
        value: string | number | boolean | Record<string, unknown> | unknown[]
      ) => {
        if (typeof value !== 'string') return 'Must be a string'
        const envs = ['development', 'test', 'production']
        return envs.includes(value)
          ? true
          : `Must be one of: ${envs.join(', ')}`
      },
    },
  },
  plugins: [
    {
      name: 'genFile',
      options: {
        name: 'workspace-demo',
        formats: ['env'],
      },
    },
  ],
})
