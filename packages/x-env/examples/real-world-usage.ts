/**
 * 真实世界使用示例：展示如何在项目中使用 Standard Schema
 * 用户可以选择自己喜欢的验证库，同时保持与 x-env 生成的配置兼容
 */

import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

// 模拟 x-env 生成的 Standard Schema 配置
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { value: Output }
      | { issues: Array<{ message: string; path?: any[] }> }
  }
}

// 模拟生成的配置类型
interface AppConfig {
  database: {
    host: string
    port: number
    name: string
  }
  redis: {
    url: string
    ttl: number
  }
  features: {
    auth: boolean
    analytics: boolean
    cache: boolean
  }
  limits: {
    maxUsers: number
    rateLimit: number
  }
}

// 模拟从环境变量解析的原始数据
const envData = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'myapp',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL || '3600'),
  },
  features: {
    auth: process.env.ENABLE_AUTH === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    cache: process.env.ENABLE_CACHE !== 'false',
  },
  limits: {
    maxUsers: parseInt(process.env.MAX_USERS || '1000'),
    rateLimit: parseInt(process.env.RATE_LIMIT || '100'),
  },
} satisfies AppConfig

console.log('🚀 Real-world Standard Schema usage examples\n')

// 场景 1: 使用 Zod 进行额外验证
console.log('📋 Scenario 1: Using Zod for additional validation')

const zodConfigSchema = z.object({
  database: z.object({
    host: z.string().min(1),
    port: z.number().min(1).max(65535),
    name: z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/, 'Database name must be alphanumeric'),
  }),
  redis: z.object({
    url: z.string().url(),
    ttl: z.number().positive(),
  }),
  features: z.object({
    auth: z.boolean(),
    analytics: z.boolean(),
    cache: z.boolean(),
  }),
  limits: z.object({
    maxUsers: z.number().min(1).max(100000),
    rateLimit: z.number().min(1).max(10000),
  }),
})

function validateWithZod(data: unknown): AppConfig {
  const result = zodConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(
      `Configuration validation failed: ${result.error.issues.map(i => i.message).join(', ')}`
    )
  }
  return result.data
}

try {
  const validatedConfig = validateWithZod(envData)
  console.log('✅ Zod validation passed')
  console.log('📊 Database config:', validatedConfig.database)
  console.log(
    '🔧 Features enabled:',
    Object.entries(validatedConfig.features)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
  )
} catch (error) {
  console.log('❌ Zod validation failed:', error)
}

// 场景 2: 使用 Valibot 进行类型转换和验证
console.log('\n📋 Scenario 2: Using Valibot for type coercion and validation')

const valibotConfigSchema = v.object({
  database: v.object({
    host: v.pipe(v.string(), v.minLength(1)),
    port: v.pipe(v.number(), v.minValue(1), v.maxValue(65535)),
    name: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_]+$/)),
  }),
  redis: v.object({
    url: v.pipe(v.string(), v.url()),
    ttl: v.pipe(v.number(), v.minValue(1)),
  }),
  features: v.object({
    auth: v.boolean(),
    analytics: v.boolean(),
    cache: v.boolean(),
  }),
  limits: v.object({
    maxUsers: v.pipe(v.number(), v.minValue(1), v.maxValue(100000)),
    rateLimit: v.pipe(v.number(), v.minValue(1), v.maxValue(10000)),
  }),
})

function validateWithValibot(data: unknown): AppConfig {
  const result = v.safeParse(valibotConfigSchema, data)
  if (!result.success) {
    throw new Error(
      `Configuration validation failed: ${result.issues.map(i => i.message).join(', ')}`
    )
  }
  return result.output
}

try {
  const validatedConfig = validateWithValibot(envData)
  console.log('✅ Valibot validation passed')
  console.log('🔗 Redis config:', validatedConfig.redis)
  console.log(
    '⚡ Rate limit:',
    validatedConfig.limits.rateLimit,
    'requests/min'
  )
} catch (error) {
  console.log('❌ Valibot validation failed:', error)
}

// 场景 3: 使用 ArkType 进行高性能验证
console.log('\n📋 Scenario 3: Using ArkType for high-performance validation')

const arkTypeConfigSchema = type({
  database: {
    host: 'string > 0',
    port: '1 <= number <= 65535',
    name: 'string > 0',
  },
  redis: {
    url: 'string > 0',
    ttl: 'number > 0',
  },
  features: {
    auth: 'boolean',
    analytics: 'boolean',
    cache: 'boolean',
  },
  limits: {
    maxUsers: '1 <= number <= 100000',
    rateLimit: '1 <= number <= 10000',
  },
})

function validateWithArkType(data: unknown): AppConfig {
  const result = arkTypeConfigSchema(data)
  if (result && typeof result === 'object' && result[' arkKind'] === 'errors') {
    const errors = Array.isArray(result) ? result : [result]
    throw new Error(
      `Configuration validation failed: ${errors.map((e: any) => e.message || 'Validation error').join(', ')}`
    )
  }
  return result as AppConfig
}

try {
  const validatedConfig = validateWithArkType(envData)
  console.log('✅ ArkType validation passed')
  console.log('👥 Max users:', validatedConfig.limits.maxUsers)
  console.log('🎯 All features:', validatedConfig.features)
} catch (error) {
  console.log('❌ ArkType validation failed:', error)
}

// 场景 4: 创建通用的 Standard Schema 适配器
console.log('\n📋 Scenario 4: Universal Standard Schema adapter')

class ConfigValidator {
  private schema: StandardSchemaV1<unknown, AppConfig>

  constructor(schema: StandardSchemaV1<unknown, AppConfig>) {
    this.schema = schema
  }

  validate(data: unknown): AppConfig {
    const result = this.schema['~standard'].validate(data)
    if ('issues' in result) {
      throw new Error(
        `Validation failed: ${result.issues.map(i => i.message).join(', ')}`
      )
    }
    return result.value
  }

  getVendor(): string {
    return this.schema['~standard'].vendor
  }
}

// 将不同的验证库包装成 Standard Schema
function wrapZod<T>(zodSchema: z.ZodSchema<T>): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'zod',
      validate: (value: unknown) => {
        const result = zodSchema.safeParse(value)
        return result.success
          ? { value: result.data }
          : {
              issues: result.error.issues.map(i => ({
                message: i.message,
                path: i.path,
              })),
            }
      },
    },
  }
}

// 使用统一接口
const zodValidator = new ConfigValidator(wrapZod(zodConfigSchema))
const validatedConfig = zodValidator.validate(envData)

console.log(`✅ Universal validation with ${zodValidator.getVendor()}`)
console.log('🎉 Configuration successfully validated and ready to use!')

console.log('\n📝 Benefits of Standard Schema approach:')
console.log('- ✨ Use any validation library you prefer')
console.log('- 🔄 Easy to switch between libraries')
console.log('- 🛡️ Type safety maintained throughout')
console.log('- 🚀 Generated schemas work with all libraries')
console.log('- 📦 No vendor lock-in')
