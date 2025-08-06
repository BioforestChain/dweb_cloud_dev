import type { SafenvConfig } from '../src/types.ts'
import { GenTsPlugin } from '../src/plugins/genTs.ts'

// 使用新的类型安全配置
const config: SafenvConfig = {
  name: 'typed-config-demo',
  description: 'Demo configuration with enhanced type safety',
  variables: {
    // 字符串类型，带约束
    APP_NAME: {
      type: 'string',
      description: 'Application name',
      default: 'My App',
      required: false,
      constraints: {
        minLength: 1,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9\s-_]+$/,
      },
    },

    // 数字类型，带范围约束
    PORT: {
      type: 'number',
      description: 'Server port',
      default: 3000,
      required: false,
      constraints: {
        min: 1,
        max: 65535,
        integer: true,
      },
    },

    // 必需的字符串，带格式验证
    DATABASE_URL: {
      type: 'string',
      description: 'Database connection URL',
      required: true,
      constraints: {
        format: 'url',
        minLength: 10,
      },
    },

    // 邮箱格式验证
    ADMIN_EMAIL: {
      type: 'string',
      description: 'Administrator email address',
      default: 'admin@example.com',
      required: false,
      constraints: {
        format: 'email',
      },
    },

    // 数组类型，带项目约束
    FEATURE_FLAGS: {
      type: 'array',
      description: 'Enabled feature flags',
      default: [],
      required: false,
      constraints: {
        minItems: 0,
        maxItems: 10,
        itemType: 'string',
        uniqueItems: true,
      },
    },

    // 布尔类型
    DEBUG: {
      type: 'boolean',
      description: 'Enable debug mode',
      default: false,
      required: false,
    },

    // 对象类型，带属性定义
    API_CONFIG: {
      type: 'object',
      description: 'API configuration object',
      default: {
        timeout: 5000,
        retries: 3,
        baseUrl: 'https://api.example.com',
      },
      required: false,
      constraints: {
        properties: {
          timeout: {
            type: 'number',
            constraints: { min: 1000, max: 30000, integer: true },
          },
          retries: {
            type: 'number',
            constraints: { min: 0, max: 10, integer: true },
          },
          baseUrl: {
            type: 'string',
            constraints: { format: 'url' },
          },
        },
        required: ['timeout', 'retries'],
        additionalProperties: true,
      },
    },

    // 带自定义验证的数字
    MAX_CONNECTIONS: {
      type: 'number',
      description: 'Maximum number of concurrent connections',
      default: 100,
      required: false,
      constraints: {
        min: 1,
        max: 1000,
        integer: true,
        multipleOf: 10,
      },
      validate: value => {
        if (value > 500) {
          return 'High connection count may impact performance'
        }
        return true
      },
    },
  },

  // Schema 全局配置
  schema: {
    vendor: 'safenv',
    strict: true,
    coercion: true,
  },

  plugins: [
    new GenTsPlugin({
      outputPath: './examples/generated-typed-schema.ts',
      validatorName: 'createTypedConfigSchema',
      validatorStyle: 'pure',
      exportMode: 'process.env',
      exportName: 'config',
    }),
  ],
}

export default config

// 类型推导示例
type ConfigVariables = typeof config.variables
type ResolvedConfig = {
  [K in keyof ConfigVariables]: ConfigVariables[K] extends { type: infer T }
    ? T extends 'string'
      ? string
      : T extends 'number'
        ? number
        : T extends 'boolean'
          ? boolean
          : T extends 'array'
            ? unknown[]
            : T extends 'object'
              ? Record<string, unknown>
              : never
    : never
}

// 现在 TypeScript 可以推导出精确的类型：
// ResolvedConfig = {
//   APP_NAME: string
//   PORT: number
//   DATABASE_URL: string
//   ADMIN_EMAIL: string
//   FEATURE_FLAGS: unknown[]
//   DEBUG: boolean
//   API_CONFIG: Record<string, unknown>
//   MAX_CONNECTIONS: number
// }
