// 注意：在实际使用中，应该从 '@dweb-cloud/safenv' 导入
// import { defineConfig, stringVar, numberVar, booleanVar, arrayVar, objectVar, commonVars, constraints, validators, GenTsPlugin } from '@dweb-cloud/safenv'

// 开发环境下的导入
import {
  defineConfig,
  stringVar,
  numberVar,
  booleanVar,
  arrayVar,
  objectVar,
  commonVars,
  constraints,
  validators,
} from '../src/config-builder.ts'
import { GenTsPlugin } from '../src/plugins/genTs.ts'

// 使用类型安全的配置构建器
const config = defineConfig({
  name: 'builder-demo',
  description: 'Demo using type-safe configuration builders',

  variables: {
    // 使用预定义的通用变量
    APP_NAME: commonVars.appName('Builder Demo App'),
    PORT: commonVars.port(8080),
    DATABASE_URL: commonVars.databaseUrl(),
    ADMIN_EMAIL: commonVars.adminEmail(),
    DEBUG: commonVars.debug(),
    FEATURE_FLAGS: commonVars.featureFlags(),

    // 使用约束构建器的自定义变量
    API_VERSION: stringVar({
      description: 'API version',
      default: 'v1',
      required: false,
      constraints: constraints.string.pattern(/^v\d+$/),
      validate: validators.string.slug,
    }),

    MAX_RETRIES: numberVar({
      description: 'Maximum retry attempts',
      default: 3,
      required: false,
      constraints: constraints.number.range(0, 10),
      validate: validators.number.even,
    }),

    CACHE_SIZE: numberVar({
      description: 'Cache size in MB (must be power of 2)',
      default: 64,
      required: false,
      constraints: {
        ...constraints.number.positive(),
        multipleOf: 2,
      },
      validate: validators.number.powerOfTwo,
    }),

    ALLOWED_ORIGINS: arrayVar({
      description: 'Allowed CORS origins',
      default: ['http://localhost:3000'],
      required: false,
      constraints: {
        ...constraints.array.nonEmpty(),
        ...constraints.array.unique(),
        maxItems: 10,
        itemType: 'string',
      },
      validate: validators.array.noDuplicates,
    }),

    RATE_LIMIT: objectVar({
      description: 'Rate limiting configuration',
      default: {
        windowMs: 900000, // 15 minutes
        max: 100,
        message: 'Too many requests',
      },
      required: false,
      constraints: {
        properties: {
          windowMs: {
            type: 'number',
            constraints: constraints.number.positive(),
          },
          max: {
            type: 'number',
            constraints: constraints.number.range(1, 10000),
          },
          message: {
            type: 'string',
            constraints: constraints.string.nonEmpty(),
          },
        },
        required: ['windowMs', 'max'],
        additionalProperties: true,
      },
    }),

    // 复杂的字符串验证
    SERVICE_NAME: stringVar({
      description: 'Kubernetes service name',
      default: 'my-service',
      required: false,
      constraints: {
        ...constraints.string.length(3, 63),
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
      },
      validate: value => {
        if (value.startsWith('-') || value.endsWith('-')) {
          return 'Service name cannot start or end with hyphen'
        }
        if (value.includes('--')) {
          return 'Service name cannot contain consecutive hyphens'
        }
        return true
      },
    }),

    // 百分比数值
    CPU_THRESHOLD: numberVar({
      description: 'CPU usage threshold percentage',
      default: 80,
      required: false,
      constraints: constraints.number.percentage(),
      validate: value => {
        if (value > 95) {
          return 'CPU threshold above 95% may cause instability'
        }
        return true
      },
    }),
  },

  schema: {
    vendor: 'safenv-builder',
    strict: true,
    coercion: true,
  },

  plugins: [
    new GenTsPlugin({
      outputPath: './examples/generated-builder-schema.ts',
      validatorName: 'createBuilderConfigSchema',
      validatorStyle: 'pure',
      exportMode: 'process.env',
      exportName: 'config',
    }),
  ],
})

export default config

// 类型推导验证 - TypeScript 现在可以精确推导类型
type ConfigType = typeof config
type VariablesType = ConfigType['variables']

// 验证类型推导是否正确
const _typeCheck: {
  APP_NAME: string
  PORT: number
  DATABASE_URL: string
  ADMIN_EMAIL: string
  DEBUG: boolean
  FEATURE_FLAGS: unknown[]
  API_VERSION: string
  MAX_RETRIES: number
  CACHE_SIZE: number
  ALLOWED_ORIGINS: unknown[]
  RATE_LIMIT: Record<string, unknown>
  SERVICE_NAME: string
  CPU_THRESHOLD: number
} = {} as any // 这只是类型检查，不会在运行时执行

// 导出类型以供其他文件使用
export type BuilderDemoConfig = typeof _typeCheck
