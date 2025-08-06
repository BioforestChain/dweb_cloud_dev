import { defineConfig } from '../../../../src/config-builder.ts'

export default defineConfig({
  name: 'base-service',
  description: 'Base service configuration with database and cache settings',
  variables: {
    // 数据库配置
    DB_HOST: {
      type: 'string',
      description: 'Database host address',
      default: 'localhost',
      required: true,
      constraints: {
        minLength: 1,
      },
    },
    DB_PORT: {
      type: 'number',
      description: 'Database port number',
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
      description: 'Database name',
      default: 'baseservice',
      required: true,
      constraints: {
        pattern: /^[a-zA-Z0-9_]+$/,
        minLength: 1,
        maxLength: 64,
      },
    },
    DB_USER: {
      type: 'string',
      description: 'Database username',
      required: true,
      constraints: {
        minLength: 1,
      },
    },
    DB_PASSWORD: {
      type: 'string',
      description: 'Database password',
      required: true,
      constraints: {
        minLength: 8,
      },
    },
    // Redis配置
    REDIS_URL: {
      type: 'string',
      description: 'Redis connection URL',
      default: 'redis://localhost:6379',
      constraints: {
        pattern: /^redis:\/\/.+/,
      },
    },
    REDIS_TTL: {
      type: 'number',
      description: 'Redis default TTL in seconds',
      default: 3600,
      constraints: {
        min: 1,
        integer: true,
      },
    },
    // 服务配置
    SERVICE_PORT: {
      type: 'number',
      description: 'Service HTTP port',
      default: 3000,
      constraints: {
        min: 1000,
        max: 65535,
        integer: true,
      },
    },
    LOG_LEVEL: {
      type: 'string',
      description: 'Logging level',
      default: 'info',
      validate: (value: string) => {
        const levels = ['error', 'warn', 'info', 'debug']
        return levels.includes(value) || `Must be one of: ${levels.join(', ')}`
      },
    },
  },
  plugins: [
    {
      name: 'genTs',
      options: {
        outputPath: './src/generated/config.ts',
        exportName: 'BaseServiceConfig',
        validatorStyle: 'pure',
        exportMode: 'process.env',
      },
    },
    {
      name: 'genFile',
      options: {
        name: 'base-service',
        formats: ['env', 'json'],
      },
    },
  ],
})
